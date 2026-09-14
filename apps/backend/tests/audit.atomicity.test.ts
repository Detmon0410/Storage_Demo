import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUser } from "./fixtures/testUser.js";

async function loginAs(username: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ username, password });
  return res.body.accessToken as string;
}

describe("Category CRUD audit atomicity", () => {
  afterAll(cleanupTestUsers);

  it("a mutation that fails inside the transaction leaves zero new Category and AuditLog rows", async () => {
    const { username, password } = await createTestUser("audit_atomicity");
    const accessToken = await loginAs(username, password);
    const categoryCode = `test_cat_dup_${Date.now()}`;

    const firstRes = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryCode, categoryName: "First" });
    expect(firstRes.status).toBe(201);
    const firstCategoryId = firstRes.body.categoryId;

    const categoryCountBefore = await prisma.category.count();
    const auditCountBefore = await prisma.auditLog.count();

    const dupRes = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryCode, categoryName: "Duplicate" });

    expect(dupRes.status).toBe(409);

    const categoryCountAfter = await prisma.category.count();
    const auditCountAfter = await prisma.auditLog.count();

    expect(categoryCountAfter).toBe(categoryCountBefore);
    expect(auditCountAfter).toBe(auditCountBefore);

    await prisma.category.delete({ where: { categoryId: firstCategoryId } });
  });
});
