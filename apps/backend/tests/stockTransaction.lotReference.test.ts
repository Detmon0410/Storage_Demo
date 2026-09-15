import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./setup.js";
import { createStockTransactionTx, reverseAndDeleteByReferenceTx } from "../src/models/stockTransaction.model.js";

describe("StockTransaction lot reference (STOCK-05)", () => {
  let categoryId: number;
  let supplierId: number;
  let productId: number;
  const createdInventoryStockIds: number[] = [];
  const createdTransactionNos: string[] = [];

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: { categoryCode: `TEST_STXLR_CAT_${Date.now()}`, categoryName: "StockTx Lot Reference Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_STXLR_SUP_${Date.now()}`, supplierName: "StockTx Lot Reference Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const product = await prisma.product.create({
      data: {
        productCode: `TEST_STXLR_PROD_${Date.now()}`,
        productName: "StockTx Lot Reference Test Product",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 30,
        unitPrice: 10,
        status: "active",
      },
    });
    productId = product.productId;
  });

  afterAll(async () => {
    await prisma.stockTransaction.deleteMany({ where: { transactionNo: { in: createdTransactionNos } } });
    await prisma.inventoryStock.deleteMany({ where: { inventoryStockId: { in: createdInventoryStockIds } } });
    await prisma.product.deleteMany({ where: { productId } });
    await prisma.supplier.deleteMany({ where: { supplierId } });
    await prisma.category.deleteMany({ where: { categoryId } });
  });

  it("1. carries the supplied inventoryStockId and increments the lot's quantityOnHand", async () => {
    const lot = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_STXLR_LOT_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 30,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    createdInventoryStockIds.push(lot.inventoryStockId);
    createdTransactionNos.push("TEST-TX-1");

    const transaction = await prisma.$transaction((tx) =>
      createStockTransactionTx(tx, {
        transactionNo: "TEST-TX-1",
        productId,
        transactionType: "OUT",
        quantity: 5,
        referenceNo: "TEST-REF-1",
        inventoryStockId: lot.inventoryStockId,
      }),
    );

    expect(transaction.inventoryStockId).toBe(lot.inventoryStockId);

    const afterLot = await prisma.inventoryStock.findUnique({ where: { inventoryStockId: lot.inventoryStockId } });
    expect(afterLot!.quantityOnHand).toBe(25);
  });

  it("2. leaves inventoryStockId null when omitted (backward compatible)", async () => {
    createdTransactionNos.push("TEST-TX-2");
    const transaction = await prisma.$transaction((tx) =>
      createStockTransactionTx(tx, {
        transactionNo: "TEST-TX-2",
        productId,
        transactionType: "IN",
        quantity: 3,
        referenceNo: "TEST-REF-2",
      }),
    );

    expect(transaction.inventoryStockId).toBeNull();
  });

  it("3. reverseAndDeleteByReferenceTx restores lot quantity and deletes the transaction row", async () => {
    const beforeLot = await prisma.inventoryStock.findFirst({
      where: { inventoryStockId: { in: createdInventoryStockIds } },
    });
    expect(beforeLot!.quantityOnHand).toBe(25);

    await prisma.$transaction((tx) => reverseAndDeleteByReferenceTx(tx, "TEST-REF-1"));

    const afterLot = await prisma.inventoryStock.findUnique({ where: { inventoryStockId: beforeLot!.inventoryStockId } });
    expect(afterLot!.quantityOnHand).toBe(30);

    const tx1 = await prisma.stockTransaction.findFirst({ where: { transactionNo: "TEST-TX-1" } });
    expect(tx1).toBeNull();
  });
});
