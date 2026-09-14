import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

async function loginAs(username: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ username, password });
  return res.body.accessToken as string;
}

describe("Product/InventoryStock/StockTransaction CRUD audit logging (batch B)", () => {
  let categoryId: number;
  let supplierId: number;
  let productId: number;

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: { categoryCode: `TEST_AUDB_CAT_${Date.now()}`, categoryName: "Audit Batch B Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_AUDB_SUP_${Date.now()}`, supplierName: "Audit Batch B Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const product = await prisma.product.create({
      data: {
        productCode: `TEST_AUDB_PROD_${Date.now()}`,
        productName: "Audit Batch B Test Product",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 100,
        unitPrice: 10,
        status: "active",
      },
    });
    productId = product.productId;
  });

  afterAll(async () => {
    await cleanupTestUsers();
    await prisma.stockTransaction.deleteMany({ where: { productId } });
    await prisma.product.deleteMany({ where: { productId } });
    await prisma.supplier.deleteMany({ where: { supplierId } });
    await prisma.category.deleteMany({ where: { categoryId } });
  });

  it("create+update+delete round-trip on Product each produce a matching AuditLog row", async () => {
    const { username, password } = await createTestUserWithRoles("audit_batchb_product", ["SYSTEM_ADMIN"]);
    const accessToken = await loginAs(username, password);
    const productCode = `test_audb_prod_${Date.now()}`;

    const createRes = await request(app)
      .post("/api/products")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        productCode,
        productName: "Round Trip Product",
        categoryId,
        supplierId,
        unit: "bottle",
        unitPrice: 20,
      });
    expect(createRes.status).toBe(201);
    const roundTripProductId = createRes.body.productId;

    let logs = await prisma.auditLog.findMany({
      where: { entity: "Product", entityId: String(roundTripProductId), action: "create" },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].before).toBeNull();
    expect((logs[0].after as { productCode: string }).productCode).toBe(productCode);

    const updateRes = await request(app)
      .put(`/api/products/${roundTripProductId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ productName: "Round Trip Product Updated" });
    expect(updateRes.status).toBe(200);

    logs = await prisma.auditLog.findMany({
      where: { entity: "Product", entityId: String(roundTripProductId), action: "update" },
    });
    expect(logs.length).toBe(1);
    expect((logs[0].before as { productName: string }).productName).toBe("Round Trip Product");
    expect((logs[0].after as { productName: string }).productName).toBe("Round Trip Product Updated");

    const deleteRes = await request(app)
      .delete(`/api/products/${roundTripProductId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleteRes.status).toBe(204);

    logs = await prisma.auditLog.findMany({
      where: { entity: "Product", entityId: String(roundTripProductId), action: "delete" },
    });
    expect(logs.length).toBe(1);
    expect((logs[0].before as { productName: string }).productName).toBe("Round Trip Product Updated");
    expect(logs[0].after).toBeNull();
  });

  it("creating a StockTransaction produces a matching AuditLog row AND increments product.stockQty atomically", async () => {
    const { username, password } = await createTestUserWithRoles("audit_batchb_stocktx_create", [
      "WAREHOUSE_DISTRIBUTION_OFFICER",
    ]);
    const accessToken = await loginAs(username, password);
    const transactionNo = `TEST_AUDB_STOCK_${Date.now()}`;

    const before = await prisma.product.findUnique({ where: { productId }, select: { stockQty: true } });

    const createRes = await request(app)
      .post("/api/stock-transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ transactionNo, productId, transactionType: "IN", quantity: 15 });

    expect(createRes.status).toBe(201);
    const transactionId = createRes.body.transactionId;

    const logs = await prisma.auditLog.findMany({
      where: { entity: "StockTransaction", entityId: String(transactionId), action: "create" },
    });
    expect(logs.length).toBe(1);
    expect(logs[0].before).toBeNull();
    expect((logs[0].after as { transactionNo: string }).transactionNo).toBe(transactionNo);

    const after = await prisma.product.findUnique({ where: { productId }, select: { stockQty: true } });
    expect(after!.stockQty).toBe(before!.stockQty + 15);
  });

  it("deleting a StockTransaction produces a matching AuditLog row AND reverses product.stockQty atomically", async () => {
    const { username, password } = await createTestUserWithRoles("audit_batchb_stocktx_delete", ["SYSTEM_ADMIN"]);
    const accessToken = await loginAs(username, password);
    const transactionNo = `TEST_AUDB_STOCK_DEL_${Date.now()}`;

    const createRes = await request(app)
      .post("/api/stock-transactions")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ transactionNo, productId, transactionType: "IN", quantity: 8 });
    expect(createRes.status).toBe(201);
    const transactionId = createRes.body.transactionId;

    const before = await prisma.product.findUnique({ where: { productId }, select: { stockQty: true } });

    const deleteRes = await request(app)
      .delete(`/api/stock-transactions/${transactionId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleteRes.status).toBe(204);

    const logs = await prisma.auditLog.findMany({
      where: { entity: "StockTransaction", entityId: String(transactionId), action: "delete" },
    });
    expect(logs.length).toBe(1);
    expect((logs[0].before as { transactionNo: string }).transactionNo).toBe(transactionNo);
    expect(logs[0].after).toBeNull();

    const after = await prisma.product.findUnique({ where: { productId }, select: { stockQty: true } });
    expect(after!.stockQty).toBe(before!.stockQty - 8);
  });
});
