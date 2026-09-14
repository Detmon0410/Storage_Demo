import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

async function loginAs(username: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ username, password });
  return res.body.accessToken as string;
}

describe("Product/InventoryStock/StockTransaction write-permission enforcement (batch B)", () => {
  let categoryId: number;
  let supplierId: number;
  let productId: number;
  let inventoryStockId: number;

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: { categoryCode: `TEST_RBACB_CAT_${Date.now()}`, categoryName: "RBAC Batch B Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_RBACB_SUP_${Date.now()}`, supplierName: "RBAC Batch B Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const product = await prisma.product.create({
      data: {
        productCode: `TEST_RBACB_PROD_${Date.now()}`,
        productName: "RBAC Batch B Test Product",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 100,
        unitPrice: 10,
        status: "active",
      },
    });
    productId = product.productId;

    const inventoryStock = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_RBACB_LOT_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 50,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    inventoryStockId = inventoryStock.inventoryStockId;
  });

  afterAll(async () => {
    await cleanupTestUsers();
    await prisma.stockTransaction.deleteMany({ where: { productId } });
    await prisma.inventoryStock.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { productId } });
    await prisma.supplier.deleteMany({ where: { supplierId } });
    await prisma.category.deleteMany({ where: { categoryId } });
  });

  it("denies a SALES_OFFICER creating a Product with 403", async () => {
    const { username, password } = await createTestUserWithRoles("rbacb_product_denied", ["SALES_OFFICER"]);
    const accessToken = await loginAs(username, password);

    const res = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        productCode: `test_rbacb_denied_${Date.now()}`,
        productName: "Should Be Denied",
        categoryId,
        supplierId,
        unit: "bottle",
        unitPrice: 5,
      });

    expect(res.status).toBe(403);
  });

  it("allows a WAREHOUSE_DISTRIBUTION_OFFICER to create an InventoryStock (non-403)", async () => {
    const { username, password } = await createTestUserWithRoles("rbacb_inventory_allowed", [
      "WAREHOUSE_DISTRIBUTION_OFFICER",
    ]);
    const accessToken = await loginAs(username, password);

    const res = await request(app)
      .post("/api/inventory-stocks")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        productId,
        lotBatch: `test_rbacb_lot_${Date.now()}`,
        receivedDate: new Date().toISOString(),
        quantityOnHand: 10,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      });

    expect(res.status).not.toBe(403);
  });

  it("denies a WAREHOUSE_DISTRIBUTION_OFFICER deleting an InventoryStock with 403 (Admin-only)", async () => {
    const { username, password } = await createTestUserWithRoles("rbacb_inventory_delete_denied", [
      "WAREHOUSE_DISTRIBUTION_OFFICER",
    ]);
    const accessToken = await loginAs(username, password);

    const res = await request(app)
      .delete(`/api/inventory-stocks/${inventoryStockId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });

  it("denies a SALES_OFFICER creating a StockTransaction with 403", async () => {
    const { username, password } = await createTestUserWithRoles("rbacb_stocktx_denied", ["SALES_OFFICER"]);
    const accessToken = await loginAs(username, password);

    const res = await request(app)
      .post("/api/stock-transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ transactionNo: `test_rbacb_stx_${Date.now()}`, productId, transactionType: "IN", quantity: 1 });

    expect(res.status).toBe(403);
  });

  it("allows a WAREHOUSE_DISTRIBUTION_OFFICER creating a StockTransaction (non-403)", async () => {
    const { username, password } = await createTestUserWithRoles("rbacb_stocktx_allowed", [
      "WAREHOUSE_DISTRIBUTION_OFFICER",
    ]);
    const accessToken = await loginAs(username, password);

    const res = await request(app)
      .post("/api/stock-transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ transactionNo: `test_rbacb_stx_allowed_${Date.now()}`, productId, transactionType: "IN", quantity: 1 });

    expect(res.status).not.toBe(403);
  });
});
