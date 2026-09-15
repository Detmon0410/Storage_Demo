import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

describe("Import order receiving-gate HTTP tests (STOCK-04, D-10, D-04 regression)", () => {
  let accessToken: string;
  let categoryId: number;
  let supplierId: number;
  let productAId: number;
  let productBId: number;
  const createdOrderNos: string[] = [];

  beforeAll(async () => {
    const { username, password } = await createTestUserWithRoles("importorder_receivinglots", [
      "IMPORT_COMPLIANCE_OFFICER",
    ]);
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    accessToken = loginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { categoryCode: `TEST_IORL_CAT_${Date.now()}`, categoryName: "Import Receiving Lots Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_IORL_SUP_${Date.now()}`, supplierName: "Import Receiving Lots Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const productA = await prisma.product.create({
      data: {
        productCode: `TEST_IORL_PRODA_${Date.now()}`,
        productName: "Import Receiving Lots Test Product A",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 0,
        unitPrice: 10,
        status: "active",
      },
    });
    productAId = productA.productId;

    const productB = await prisma.product.create({
      data: {
        productCode: `TEST_IORL_PRODB_${Date.now()}`,
        productName: "Import Receiving Lots Test Product B",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 0,
        unitPrice: 10,
        status: "active",
      },
    });
    productBId = productB.productId;
  });

  afterAll(async () => {
    await prisma.stockTransaction.deleteMany({ where: { referenceNo: { in: createdOrderNos.map((n) => `IO:${n}`) } } });
    await prisma.inventoryStock.deleteMany({ where: { productId: { in: [productAId, productBId] } } });
    await prisma.importOrder.deleteMany({ where: { orderNo: { in: createdOrderNos } } });
    await prisma.product.deleteMany({ where: { productId: { in: [productAId, productBId] } } });
    await prisma.supplier.deleteMany({ where: { supplierId } });
    await prisma.category.deleteMany({ where: { categoryId } });
    await cleanupTestUsers();
  });

  const baseOrder = (orderNo: string, overrides: Record<string, unknown> = {}) => ({
    orderNo,
    supplierId,
    country: "Scotland",
    incoterms: "FOB",
    orderDate: new Date().toISOString(),
    etaDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    status: "STAGING",
    items: [{ productId: productAId, quantity: 50, unitPrice: 10 }],
    ...overrides,
  });

  it("1. creating at STAGING produces zero InventoryStock and zero StockTransaction rows (D-04 regression)", async () => {
    const orderNo = `TEST_IORL_STAGING_${Date.now()}`;
    const res = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo));
    expect(res.status).toBe(201);
    createdOrderNos.push(orderNo);

    const lots = await prisma.inventoryStock.findMany({ where: { productId: productAId } });
    expect(lots.length).toBe(0);

    const stockTx = await prisma.stockTransaction.findMany({ where: { referenceNo: `IO:${orderNo}` } });
    expect(stockTx.length).toBe(0);
  });

  it("2. creating at RECEIVED with two items produces exactly one lot + one IN transaction per item", async () => {
    const orderNo = `TEST_IORL_RECEIVED_${Date.now()}`;
    const res = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        baseOrder(orderNo, {
          status: "RECEIVED",
          items: [
            { productId: productAId, quantity: 30, unitPrice: 10 },
            { productId: productBId, quantity: 45, unitPrice: 15 },
          ],
        }),
      );
    expect(res.status).toBe(201);
    createdOrderNos.push(orderNo);

    const lots = await prisma.inventoryStock.findMany({
      where: { productId: { in: [productAId, productBId] }, lotBatch: { contains: orderNo } },
      orderBy: { inventoryStockId: "asc" },
    });
    expect(lots.length).toBe(2);

    const lotA = lots.find((l) => l.productId === productAId)!;
    const lotB = lots.find((l) => l.productId === productBId)!;
    expect(lotA.quantityOnHand).toBe(30);
    expect(lotB.quantityOnHand).toBe(45);
    expect(lotA.warehouse).toBeTruthy();
    expect(lotB.warehouse).toBeTruthy();
    expect(lotA.receivedDate).toBeTruthy();
    expect(lotB.receivedDate).toBeTruthy();
    expect(lotA.lotBatch).toBe(`${orderNo}-1`);
    expect(lotB.lotBatch).toBe(`${orderNo}-2`);

    const stockTx = await prisma.stockTransaction.findMany({ where: { referenceNo: `IO:${orderNo}` } });
    expect(stockTx.length).toBe(2);
    for (const tx of stockTx) {
      expect(tx.transactionType).toBe("IN");
      expect(tx.inventoryStockId).not.toBeNull();
    }
    const txForA = stockTx.find((t) => t.inventoryStockId === lotA.inventoryStockId);
    const txForB = stockTx.find((t) => t.inventoryStockId === lotB.inventoryStockId);
    expect(txForA).toBeTruthy();
    expect(txForB).toBeTruthy();
  });

  it("3. transitioning STAGING -> RECEIVED via PUT creates lots exactly once", async () => {
    const orderNo = `TEST_IORL_TRANSITION_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { items: [{ productId: productAId, quantity: 20, unitPrice: 10 }] }));
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);

    const putRes = await request(app)
      .put(`/api/import-orders/${createRes.body.importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "RECEIVED", items: [{ productId: productAId, quantity: 20, unitPrice: 10 }] });
    expect(putRes.status).toBe(200);

    const lots = await prisma.inventoryStock.findMany({
      where: { productId: productAId, lotBatch: { contains: orderNo } },
    });
    expect(lots.length).toBe(1);
    expect(lots[0].quantityOnHand).toBe(20);

    const stockTx = await prisma.stockTransaction.findMany({ where: { referenceNo: `IO:${orderNo}` } });
    expect(stockTx.length).toBe(1);
    expect(stockTx[0].transactionType).toBe("IN");
    expect(stockTx[0].inventoryStockId).toBe(lots[0].inventoryStockId);
  });

  it("4. editing items on a RECEIVED order is rejected (400, message contains 'received'), no stock changes", async () => {
    const orderNo = `TEST_IORL_LOCKED_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { status: "RECEIVED", items: [{ productId: productAId, quantity: 25, unitPrice: 10 }] }));
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);

    const putRes = await request(app)
      .put(`/api/import-orders/${createRes.body.importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ items: [{ productId: productAId, quantity: 999, unitPrice: 10 }] });

    expect(putRes.status).toBe(400);
    expect(putRes.body.error.toLowerCase()).toContain("received");

    const lots = await prisma.inventoryStock.findMany({
      where: { productId: productAId, lotBatch: { contains: orderNo } },
    });
    expect(lots.length).toBe(1);
    expect(lots[0].quantityOnHand).toBe(25);
  });

  it("5. editing non-item fields on a RECEIVED order is allowed (200)", async () => {
    const orderNo = `TEST_IORL_FIELDONLY_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { status: "RECEIVED", items: [{ productId: productAId, quantity: 5, unitPrice: 10 }] }));
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);

    const putRes = await request(app)
      .put(`/api/import-orders/${createRes.body.importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ customsEntryNo: "NEW-ENTRY" });

    expect(putRes.status).toBe(200);
    expect(putRes.body.customsEntryNo).toBe("NEW-ENTRY");
  });
});
