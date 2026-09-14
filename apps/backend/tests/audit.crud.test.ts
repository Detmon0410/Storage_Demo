import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

async function loginAs(username: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ username, password });
  return res.body.accessToken as string;
}

describe("Category CRUD audit logging", () => {
  afterAll(cleanupTestUsers);

  it("creating a Category produces exactly one AuditLog row with entity/action/before/after", async () => {
    const { username, password } = await createTestUserWithRoles("audit_crud_create", ["SYSTEM_ADMIN"]);
    const accessToken = await loginAs(username, password);
    const categoryCode = `test_cat_${Date.now()}`;

    const createRes = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryCode, categoryName: "Test Category" });

    expect(createRes.status).toBe(201);
    const categoryId = createRes.body.categoryId;

    const logs = await prisma.auditLog.findMany({
      where: { entity: "Category", entityId: String(categoryId), action: "create" },
    });

    expect(logs.length).toBe(1);
    expect(logs[0].before).toBeNull();
    expect((logs[0].after as { categoryCode: string }).categoryCode).toBe(categoryCode);

    await prisma.category.delete({ where: { categoryId } });
  });

  it("updating a Category produces a second AuditLog row with before/after categoryName", async () => {
    const { username, password } = await createTestUserWithRoles("audit_crud_update", ["SYSTEM_ADMIN"]);
    const accessToken = await loginAs(username, password);
    const categoryCode = `test_cat_${Date.now()}`;

    const createRes = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryCode, categoryName: "Original Name" });
    const categoryId = createRes.body.categoryId;

    const updateRes = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryCode, categoryName: "Updated Name" });

    expect(updateRes.status).toBe(200);

    const logs = await prisma.auditLog.findMany({
      where: { entity: "Category", entityId: String(categoryId), action: "update" },
    });

    expect(logs.length).toBe(1);
    expect((logs[0].before as { categoryName: string }).categoryName).toBe("Original Name");
    expect((logs[0].after as { categoryName: string }).categoryName).toBe("Updated Name");

    await prisma.category.delete({ where: { categoryId } });
  });
});
