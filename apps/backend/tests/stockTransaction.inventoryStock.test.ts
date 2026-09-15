import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./setup.js";
import { StockTransactionModel } from "../src/models/stockTransaction.model.js";

describe("StockTransactionModel InventoryStock sync", () => {
  const createdProductIds: number[] = [];
  const createdInventoryStockIds: number[] = [];
  const createdTransactionNos: string[] = [];
  let categoryId: number;
  let supplierId: number;

  afterAll(async () => {
    await prisma.stockTransaction.deleteMany({ where: { transactionNo: { in: createdTransactionNos } } });
    await prisma.inventoryStock.deleteMany({ where: { inventoryStockId: { in: createdInventoryStockIds } } });
    await prisma.product.deleteMany({ where: { productId: { in: createdProductIds } } });
    if (supplierId) await prisma.supplier.deleteMany({ where: { supplierId } });
    if (categoryId) await prisma.category.deleteMany({ where: { categoryId } });
  });

  const setupCategoryAndSupplier = async () => {
    if (!categoryId) {
      const category = await prisma.category.create({
        data: { categoryCode: `TEST_STXIS_CAT_${Date.now()}`, categoryName: "StockTx InventoryStock Test Category" },
      });
      categoryId = category.categoryId;
    }
    if (!supplierId) {
      const supplier = await prisma.supplier.create({
        data: { supplierCode: `TEST_STXIS_SUP_${Date.now()}`, supplierName: "StockTx InventoryStock Test Supplier", status: "ACTIVE" },
      });
      supplierId = supplier.supplierId;
    }
  };

  const createProduct = async (suffix: string, stockQty = 100) => {
    await setupCategoryAndSupplier();
    const product = await prisma.product.create({
      data: {
        productCode: `TEST_STXIS_PROD_${suffix}_${Date.now()}`,
        productName: `StockTx InventoryStock Test Product ${suffix}`,
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty,
        unitPrice: 10,
        status: "active",
      },
    });
    createdProductIds.push(product.productId);
    return product;
  };

  const createLot = async (productId: number, suffix: string, quantityOnHand: number) => {
    const lot = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_STXIS_LOT_${suffix}_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    createdInventoryStockIds.push(lot.inventoryStockId);
    return lot;
  };

  it("increments InventoryStock.quantityOnHand (and Product.stockQty) when inventoryStockId is set on an IN transaction", async () => {
    const product = await createProduct("in", 50);
    const lot = await createLot(product.productId, "in", 20);
    const transactionNo = `TEST_STXIS_IN_${Date.now()}`;
    createdTransactionNos.push(transactionNo);

    await StockTransactionModel.create({
      transactionNo,
      productId: product.productId,
      transactionType: "IN",
      quantity: 10,
      inventoryStockId: lot.inventoryStockId,
    });

    const afterLot = await prisma.inventoryStock.findUnique({ where: { inventoryStockId: lot.inventoryStockId } });
    const afterProduct = await prisma.product.findUnique({ where: { productId: product.productId } });
    expect(afterLot!.quantityOnHand).toBe(30);
    expect(afterProduct!.stockQty).toBe(60);
  });

  it("decrements InventoryStock.quantityOnHand when inventoryStockId is set on an OUT transaction", async () => {
    const product = await createProduct("out", 50);
    const lot = await createLot(product.productId, "out", 20);
    const transactionNo = `TEST_STXIS_OUT_${Date.now()}`;
    createdTransactionNos.push(transactionNo);

    await StockTransactionModel.create({
      transactionNo,
      productId: product.productId,
      transactionType: "OUT",
      quantity: 10,
      inventoryStockId: lot.inventoryStockId,
    });

    const afterLot = await prisma.inventoryStock.findUnique({ where: { inventoryStockId: lot.inventoryStockId } });
    const afterProduct = await prisma.product.findUnique({ where: { productId: product.productId } });
    expect(afterLot!.quantityOnHand).toBe(10);
    expect(afterProduct!.stockQty).toBe(40);
  });

  it("leaves InventoryStock untouched when inventoryStockId is omitted (existing behavior unchanged)", async () => {
    const product = await createProduct("noLot", 50);
    const lot = await createLot(product.productId, "noLot", 20);
    const transactionNo = `TEST_STXIS_NOLOT_${Date.now()}`;
    createdTransactionNos.push(transactionNo);

    await StockTransactionModel.create({
      transactionNo,
      productId: product.productId,
      transactionType: "IN",
      quantity: 10,
    });

    const afterLot = await prisma.inventoryStock.findUnique({ where: { inventoryStockId: lot.inventoryStockId } });
    const afterProduct = await prisma.product.findUnique({ where: { productId: product.productId } });
    expect(afterLot!.quantityOnHand).toBe(20);
    expect(afterProduct!.stockQty).toBe(60);
  });

  it("restores InventoryStock.quantityOnHand by the inverse delta when reversing via referenceNo", async () => {
    const product = await createProduct("reverse", 50);
    const lot = await createLot(product.productId, "reverse", 20);
    const transactionNo = `TEST_STXIS_REV_${Date.now()}`;
    const referenceNo = `TEST_STXIS_REV_REF_${Date.now()}`;
    createdTransactionNos.push(transactionNo);

    await StockTransactionModel.create({
      transactionNo,
      productId: product.productId,
      transactionType: "OUT",
      quantity: 5,
      inventoryStockId: lot.inventoryStockId,
      referenceNo,
    });

    const midLot = await prisma.inventoryStock.findUnique({ where: { inventoryStockId: lot.inventoryStockId } });
    expect(midLot!.quantityOnHand).toBe(15);

    await prisma.$transaction(async (tx) => {
      const { reverseAndDeleteByReferenceTx } = await import("../src/models/stockTransaction.model.js");
      await reverseAndDeleteByReferenceTx(tx, referenceNo);
    });

    const afterLot = await prisma.inventoryStock.findUnique({ where: { inventoryStockId: lot.inventoryStockId } });
    const afterProduct = await prisma.product.findUnique({ where: { productId: product.productId } });
    expect(afterLot!.quantityOnHand).toBe(20);
    expect(afterProduct!.stockQty).toBe(50);
  });
});
