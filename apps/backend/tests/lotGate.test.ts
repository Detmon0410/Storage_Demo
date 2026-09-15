import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./setup.js";
import { assertLotQuantityTx, suggestFifoLot } from "../src/utils/lotGate.js";
import { HttpError } from "../src/middleware/errorHandler.js";

describe("lotGate", () => {
  const createdProductIds: number[] = [];
  const createdInventoryStockIds: number[] = [];
  let categoryId: number;
  let supplierId: number;

  afterAll(async () => {
    await prisma.inventoryStock.deleteMany({ where: { inventoryStockId: { in: createdInventoryStockIds } } });
    await prisma.product.deleteMany({ where: { productId: { in: createdProductIds } } });
    if (supplierId) await prisma.supplier.deleteMany({ where: { supplierId } });
    if (categoryId) await prisma.category.deleteMany({ where: { categoryId } });
  });

  const setupCategoryAndSupplier = async () => {
    if (!categoryId) {
      const category = await prisma.category.create({
        data: { categoryCode: `TEST_LOTG_CAT_${Date.now()}`, categoryName: "Lot Gate Test Category" },
      });
      categoryId = category.categoryId;
    }
    if (!supplierId) {
      const supplier = await prisma.supplier.create({
        data: { supplierCode: `TEST_LOTG_SUP_${Date.now()}`, supplierName: "Lot Gate Test Supplier", status: "ACTIVE" },
      });
      supplierId = supplier.supplierId;
    }
  };

  const createProduct = async (suffix: string) => {
    await setupCategoryAndSupplier();
    const product = await prisma.product.create({
      data: {
        productCode: `TEST_LOTG_PROD_${suffix}_${Date.now()}`,
        productName: `Lot Gate Test Product ${suffix}`,
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 100,
        unitPrice: 10,
        status: "active",
      },
    });
    createdProductIds.push(product.productId);
    return product;
  };

  const createLot = async (productId: number, suffix: string, quantityOnHand: number, receivedDate = new Date()) => {
    const lot = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_LOTG_LOT_${suffix}_${Date.now()}`,
        receivedDate,
        quantityOnHand,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    createdInventoryStockIds.push(lot.inventoryStockId);
    return lot;
  };

  describe("assertLotQuantityTx", () => {
    it("resolves without throwing when quantity is within the lot's quantityOnHand", async () => {
      const product = await createProduct("within");
      const lot = await createLot(product.productId, "within", 20);

      await expect(
        prisma.$transaction(async (tx) => {
          await assertLotQuantityTx(tx, [{ inventoryStockId: lot.inventoryStockId, quantity: 10 }]);
        }),
      ).resolves.not.toThrow();
    });

    it("throws HttpError 400 with an 'insufficient' message when quantity exceeds quantityOnHand", async () => {
      const product = await createProduct("exceed");
      const lot = await createLot(product.productId, "exceed", 5);

      try {
        await prisma.$transaction(async (tx) => {
          await assertLotQuantityTx(tx, [{ inventoryStockId: lot.inventoryStockId, quantity: 10 }]);
        });
        throw new Error("expected rejection");
      } catch (err) {
        expect(err).toBeInstanceOf(HttpError);
        expect((err as HttpError).status).toBe(400);
        expect((err as HttpError).message.toLowerCase()).toContain("insufficient");
      }
    });

    it("throws HttpError 404 when the inventoryStockId does not exist", async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await assertLotQuantityTx(tx, [{ inventoryStockId: 999999999, quantity: 1 }]);
        }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it("resolves without throwing and without querying the database when items is empty", async () => {
      await expect(
        prisma.$transaction(async (tx) => {
          await assertLotQuantityTx(tx, []);
        }),
      ).resolves.not.toThrow();
    });
  });

  describe("suggestFifoLot", () => {
    it("returns the InventoryStock row with the earliest receivedDate among rows with quantityOnHand > 0", async () => {
      const product = await createProduct("fifo");
      const older = await createLot(product.productId, "fifo_old", 5, new Date(Date.now() - 30 * 86400000));
      await createLot(product.productId, "fifo_new", 5, new Date());
      await createLot(product.productId, "fifo_empty", 0, new Date(Date.now() - 60 * 86400000));

      const result = await prisma.$transaction(async (tx) => suggestFifoLot(tx, product.productId));
      expect(result?.inventoryStockId).toBe(older.inventoryStockId);
    });

    it("returns null when no lots with quantityOnHand > 0 exist for the product", async () => {
      const product = await createProduct("fifo_none");
      await createLot(product.productId, "fifo_none_empty", 0);

      const result = await prisma.$transaction(async (tx) => suggestFifoLot(tx, product.productId));
      expect(result).toBeNull();
    });
  });
});
