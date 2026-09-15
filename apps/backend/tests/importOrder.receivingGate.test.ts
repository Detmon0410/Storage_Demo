import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./setup.js";
import { ImportOrderModel } from "../src/models/importOrder.model.js";
import { HttpError } from "../src/middleware/errorHandler.js";

describe("ImportOrderModel receiving gate (D-04/D-10)", () => {
  let categoryId: number;
  let supplierId: number;
  let productId: number;
  const createdOrderNos: string[] = [];

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: { categoryCode: `TEST_IORG_CAT_${Date.now()}`, categoryName: "Import Receiving Gate Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_IORG_SUP_${Date.now()}`, supplierName: "Import Receiving Gate Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const product = await prisma.product.create({
      data: {
        productCode: `TEST_IORG_PROD_${Date.now()}`,
        productName: "Import Receiving Gate Test Product",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 0,
        unitPrice: 10,
        status: "active",
      },
    });
    productId = product.productId;
  });

  afterAll(async () => {
    await prisma.stockTransaction.deleteMany({ where: { referenceNo: { in: createdOrderNos.map((n) => `IO:${n}`) } } });
    await prisma.inventoryStock.deleteMany({ where: { productId } });
    await prisma.importOrder.deleteMany({ where: { orderNo: { in: createdOrderNos } } });
    await prisma.product.deleteMany({ where: { productId } });
    await prisma.supplier.deleteMany({ where: { supplierId } });
    await prisma.category.deleteMany({ where: { categoryId } });
  });

  it("create with status STAGING creates the order but no InventoryStock or StockTransaction rows", async () => {
    const orderNo = `TEST_IORG_STAGING_${Date.now()}`;
    const order = await ImportOrderModel.create({
      orderNo,
      supplierId,
      country: "Scotland",
      incoterms: "FOB",
      orderDate: new Date(),
      etaDate: new Date(Date.now() + 30 * 86400000),
      status: "STAGING",
      items: [{ productId, quantity: 50, unitPrice: 10 }],
    });
    createdOrderNos.push(orderNo);

    const lots = await prisma.inventoryStock.findMany({ where: { productId } });
    expect(lots.length).toBe(0);

    const stockTx = await prisma.stockTransaction.findMany({ where: { referenceNo: { contains: orderNo } } });
    expect(stockTx.length).toBe(0);
    expect(order.orderNo).toBe(orderNo);
  });

  it("create with status RECEIVED creates one InventoryStock lot and one linked IN StockTransaction per item", async () => {
    const orderNo = `TEST_IORG_RECEIVED_${Date.now()}`;
    await ImportOrderModel.create({
      orderNo,
      supplierId,
      country: "Scotland",
      incoterms: "FOB",
      orderDate: new Date(),
      etaDate: new Date(Date.now() + 30 * 86400000),
      status: "RECEIVED",
      items: [{ productId, quantity: 100, unitPrice: 500 }],
    });
    createdOrderNos.push(orderNo);

    const lots = await prisma.inventoryStock.findMany({ where: { productId, lotBatch: { contains: orderNo } } });
    expect(lots.length).toBe(1);
    expect(lots[0].quantityOnHand).toBe(100);
    expect(lots[0].warehouse).toBe("Unassigned");
    expect(lots[0].receivedDate).toBeTruthy();

    const stockTx = await prisma.stockTransaction.findMany({ where: { referenceNo: { contains: orderNo } } });
    expect(stockTx.length).toBe(1);
    expect(stockTx[0].transactionType).toBe("IN");
    expect(stockTx[0].inventoryStockId).toBe(lots[0].inventoryStockId);
  });

  it("update to status RECEIVED on a previously STAGING order creates lots exactly once", async () => {
    const orderNo = `TEST_IORG_TRANSITION_${Date.now()}`;
    const created = await ImportOrderModel.create({
      orderNo,
      supplierId,
      country: "Scotland",
      incoterms: "FOB",
      orderDate: new Date(),
      etaDate: new Date(Date.now() + 30 * 86400000),
      status: "STAGING",
      items: [{ productId, quantity: 20, unitPrice: 10 }],
    });
    createdOrderNos.push(orderNo);

    await ImportOrderModel.update(created.importOrderId, {
      status: "RECEIVED",
      items: [{ productId, quantity: 20, unitPrice: 10 }],
    });

    const lots = await prisma.inventoryStock.findMany({ where: { productId, lotBatch: { contains: orderNo } } });
    expect(lots.length).toBe(1);

    const stockTx = await prisma.stockTransaction.findMany({ where: { referenceNo: { contains: orderNo } } });
    expect(stockTx.length).toBe(1);
  });

  it("update items on a RECEIVED order throws HttpError(400) containing 'received', no changes persisted", async () => {
    const orderNo = `TEST_IORG_LOCKED_${Date.now()}`;
    const created = await ImportOrderModel.create({
      orderNo,
      supplierId,
      country: "Scotland",
      incoterms: "FOB",
      orderDate: new Date(),
      etaDate: new Date(Date.now() + 30 * 86400000),
      status: "RECEIVED",
      items: [{ productId, quantity: 30, unitPrice: 10 }],
    });
    createdOrderNos.push(orderNo);

    await expect(
      ImportOrderModel.update(created.importOrderId, {
        items: [{ productId, quantity: 99, unitPrice: 10 }],
      }),
    ).rejects.toMatchObject({ status: 400 });

    try {
      await ImportOrderModel.update(created.importOrderId, {
        items: [{ productId, quantity: 99, unitPrice: 10 }],
      });
    } catch (err) {
      expect((err as HttpError).message.toLowerCase()).toContain("received");
    }

    const lots = await prisma.inventoryStock.findMany({ where: { productId, lotBatch: { contains: orderNo } } });
    expect(lots.length).toBe(1);
    expect(lots[0].quantityOnHand).toBe(30);
  });

  it("update status only (no items) on a RECEIVED order is still allowed", async () => {
    const orderNo = `TEST_IORG_FIELDONLY_${Date.now()}`;
    const created = await ImportOrderModel.create({
      orderNo,
      supplierId,
      country: "Scotland",
      incoterms: "FOB",
      orderDate: new Date(),
      etaDate: new Date(Date.now() + 30 * 86400000),
      status: "RECEIVED",
      items: [{ productId, quantity: 10, unitPrice: 10 }],
    });
    createdOrderNos.push(orderNo);

    const updated = await ImportOrderModel.update(created.importOrderId, { status: "ISSUE" });
    expect(updated.status).toBe("ISSUE");
  });
});
