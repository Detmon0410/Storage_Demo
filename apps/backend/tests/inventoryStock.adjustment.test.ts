import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

describe("Inventory stock adjustment (STOCK-06)", () => {
  let adjustAccessToken: string;
  let salesOfficerAccessToken: string;
  let categoryId: number;
  let supplierId: number;
  let productId: number;
  let inventoryStockId: number;

  beforeAll(async () => {
    const { username, password } = await createTestUserWithRoles("inv_adjust_wdo", ["WAREHOUSE_DISTRIBUTION_OFFICER"]);
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    adjustAccessToken = loginRes.body.accessToken;

    const { username: salesUsername, password: salesPassword } = await createTestUserWithRoles("inv_adjust_sales", ["SALES_OFFICER"]);
    const salesLoginRes = await request(app).post("/api/auth/login").send({ username: salesUsername, password: salesPassword });
    salesOfficerAccessToken = salesLoginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { categoryCode: `TEST_INVADJ_CAT_${Date.now()}`, categoryName: "Inventory Adjustment Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_INVADJ_SUP_${Date.now()}`, supplierName: "Inventory Adjustment Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const product = await prisma.product.create({
      data: {
        productCode: `TEST_INVADJ_PROD_${Date.now()}`,
        productName: "Inventory Adjustment Test Product",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 1000,
        unitPrice: 10,
        status: "active",
      },
    });
    productId = product.productId;

    const stock = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_INVADJ_LOT_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 20,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    inventoryStockId = stock.inventoryStockId;
  });

  afterAll(async () => {
    await prisma.inventoryStock.deleteMany({ where: { inventoryStockId } });
    await prisma.product.deleteMany({ where: { productId } });
    await prisma.supplier.deleteMany({ where: { supplierId } });
    await prisma.category.deleteMany({ where: { categoryId } });
    await cleanupTestUsers();
  });

  it("applies a reason-coded negative adjustment and records an audit log entry", async () => {
    const res = await request(app)
      .post(`/api/inventory-stocks/${inventoryStockId}/adjust`)
      .set("Authorization", `Bearer ${adjustAccessToken}`)
      .send({ delta: -5, reasonCode: "DAMAGE", note: "broken in transit" });

    expect(res.status).toBe(200);
    expect(res.body.quantityOnHand).toBe(15);

    const auditLog = await prisma.auditLog.findFirst({
      where: { entity: "InventoryStock", entityId: String(inventoryStockId), action: "adjust" },
      orderBy: { createdAt: "desc" },
    });
    expect(auditLog).not.toBeNull();
  });

  it("returns 400 when an adjustment would make quantity negative", async () => {
    const res = await request(app)
      .post(`/api/inventory-stocks/${inventoryStockId}/adjust`)
      .set("Authorization", `Bearer ${adjustAccessToken}`)
      .send({ delta: -100, reasonCode: "DAMAGE" });

    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("negative");
  });

  it("returns 400 for a missing or invalid reasonCode", async () => {
    const res = await request(app)
      .post(`/api/inventory-stocks/${inventoryStockId}/adjust`)
      .set("Authorization", `Bearer ${adjustAccessToken}`)
      .send({ delta: -1, reasonCode: "BOGUS" });

    expect(res.status).toBe(400);
  });

  it("returns 403 for a user without INVENTORY_ADJUST", async () => {
    const res = await request(app)
      .post(`/api/inventory-stocks/${inventoryStockId}/adjust`)
      .set("Authorization", `Bearer ${salesOfficerAccessToken}`)
      .send({ delta: -1, reasonCode: "DAMAGE" });

    expect(res.status).toBe(403);
  });

  it("does not change quantityOnHand via a direct PUT even if the field is included in the body", async () => {
    const before = await prisma.inventoryStock.findUnique({ where: { inventoryStockId } });

    const res = await request(app)
      .put(`/api/inventory-stocks/${inventoryStockId}`)
      .set("Authorization", `Bearer ${adjustAccessToken}`)
      .send({ quantityOnHand: 999 });

    expect(res.status).toBe(200);
    expect(res.body.quantityOnHand).toBe(before?.quantityOnHand);

    const after = await prisma.inventoryStock.findUnique({ where: { inventoryStockId } });
    expect(after?.quantityOnHand).toBe(before?.quantityOnHand);
  });
});
