import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { AuditLogModelQuery } from "../src/models/auditLog.model.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

async function loginAs(username: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ username, password });
  return res.body.accessToken as string;
}

describe("AuditLogModelQuery.findMany filters", () => {
  afterAll(cleanupTestUsers);

  it("filters by entity=Category and excludes other entities", async () => {
    const { username, password } = await createTestUserWithRoles("audit_query_entity", ["SYSTEM_ADMIN"]);
    const accessToken = await loginAs(username, password);

    const categoryCode = `test_cat_${Date.now()}`;
    const createCategoryRes = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryCode, categoryName: "Query Filter Category" });
    expect(createCategoryRes.status).toBe(201);
    const categoryId = createCategoryRes.body.categoryId;

    const supplierCode = `test_sup_${Date.now()}`;
    const createSupplierRes = await request(app)
      .post("/api/suppliers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ supplierCode, supplierName: "Query Filter Supplier" });
    expect(createSupplierRes.status).toBe(201);
    const supplierId = createSupplierRes.body.supplierId;

    const results = await AuditLogModelQuery.findMany({ entity: "Category" });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.entity === "Category")).toBe(true);
    expect(results.some((r) => r.entity === "Supplier")).toBe(false);

    await prisma.category.delete({ where: { categoryId } });
    await prisma.supplier.delete({ where: { supplierId } });
  });

  it("filters by action=create and excludes other actions", async () => {
    const { username, password } = await createTestUserWithRoles("audit_query_action", ["SYSTEM_ADMIN"]);
    const accessToken = await loginAs(username, password);

    const categoryCode = `test_cat_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryCode, categoryName: "Action Filter Category" });
    const categoryId = createRes.body.categoryId;

    const updateRes = await request(app)
      .put(`/api/categories/${categoryId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryCode, categoryName: "Action Filter Category Updated" });
    expect(updateRes.status).toBe(200);

    const results = await AuditLogModelQuery.findMany({
      entity: "Category",
      action: "create",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.action === "create")).toBe(true);

    await prisma.category.delete({ where: { categoryId } });
  });

  it("excludes rows outside a from/to date range", async () => {
    const { username, password } = await createTestUserWithRoles("audit_query_daterange", ["SYSTEM_ADMIN"]);
    const accessToken = await loginAs(username, password);

    const categoryCode = `test_cat_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryCode, categoryName: "Date Range Category" });
    const categoryId = createRes.body.categoryId;

    const futureFrom = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const results = await AuditLogModelQuery.findMany({
      entity: "Category",
      from: futureFrom,
    });

    expect(results.some((r) => r.entityId === String(categoryId))).toBe(false);

    await prisma.category.delete({ where: { categoryId } });
  });

  it("orders results newest-first by createdAt", async () => {
    const { username, password } = await createTestUserWithRoles("audit_query_order", ["SYSTEM_ADMIN"]);
    const accessToken = await loginAs(username, password);

    const categoryCode1 = `test_cat_${Date.now()}_a`;
    const createRes1 = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryCode: categoryCode1, categoryName: "Order Category A" });
    const categoryId1 = createRes1.body.categoryId;

    const categoryCode2 = `test_cat_${Date.now()}_b`;
    const createRes2 = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryCode: categoryCode2, categoryName: "Order Category B" });
    const categoryId2 = createRes2.body.categoryId;

    const results = await AuditLogModelQuery.findMany({ entity: "Category" });

    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].createdAt.getTime()).toBeGreaterThanOrEqual(results[i + 1].createdAt.getTime());
    }

    await prisma.category.delete({ where: { categoryId: categoryId1 } });
    await prisma.category.delete({ where: { categoryId: categoryId2 } });
  });
});
