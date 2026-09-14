import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./setup.js";
import { assertProductsNotBlockedTx } from "../src/utils/licenseGate.js";
import { HttpError } from "../src/middleware/errorHandler.js";

describe("assertProductsNotBlockedTx", () => {
  const createdProductIds: number[] = [];
  const createdLicenseIds: number[] = [];
  let categoryId: number;
  let supplierId: number;

  afterAll(async () => {
    await prisma.license.deleteMany({ where: { licenseId: { in: createdLicenseIds } } });
    await prisma.product.deleteMany({ where: { productId: { in: createdProductIds } } });
    if (supplierId) await prisma.supplier.deleteMany({ where: { supplierId } });
    if (categoryId) await prisma.category.deleteMany({ where: { categoryId } });
  });

  const setupCategoryAndSupplier = async () => {
    if (!categoryId) {
      const category = await prisma.category.create({
        data: { categoryCode: `TEST_LG_CAT_${Date.now()}`, categoryName: "License Gate Test Category" },
      });
      categoryId = category.categoryId;
    }
    if (!supplierId) {
      const supplier = await prisma.supplier.create({
        data: { supplierCode: `TEST_LG_SUP_${Date.now()}`, supplierName: "License Gate Test Supplier", status: "ACTIVE" },
      });
      supplierId = supplier.supplierId;
    }
  };

  const createProduct = async (suffix: string) => {
    await setupCategoryAndSupplier();
    const product = await prisma.product.create({
      data: {
        productCode: `TEST_LG_PROD_${suffix}_${Date.now()}`,
        productName: `License Gate Test Product ${suffix}`,
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

  it("throws HttpError 400 mentioning the product when a linked License is EXPIRED", async () => {
    const product = await createProduct("expired");
    const license = await prisma.license.create({
      data: {
        licenseNo: `TEST_LG_LIC_EXP_${Date.now()}`,
        licenseType: "Import",
        holderName: "Test Holder",
        category: "Test",
        issueDate: new Date(Date.now() - 400 * 86400000),
        expiryDate: new Date(Date.now() - 10 * 86400000),
        productId: product.productId,
      },
    });
    createdLicenseIds.push(license.licenseId);

    await expect(
      prisma.$transaction(async (tx) => {
        await assertProductsNotBlockedTx(tx, [product.productId]);
      }),
    ).rejects.toMatchObject({ status: 400 });

    try {
      await prisma.$transaction(async (tx) => {
        await assertProductsNotBlockedTx(tx, [product.productId]);
      });
      throw new Error("expected rejection");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).message).toMatch(new RegExp(String(product.productId)));
    }
  });

  it("resolves without throwing when no License references the productIds", async () => {
    const product = await createProduct("nolicense");

    await expect(
      prisma.$transaction(async (tx) => {
        await assertProductsNotBlockedTx(tx, [product.productId]);
      }),
    ).resolves.not.toThrow();
  });

  it("resolves without throwing when the linked License has a future expiryDate", async () => {
    const product = await createProduct("future");
    const license = await prisma.license.create({
      data: {
        licenseNo: `TEST_LG_LIC_FUT_${Date.now()}`,
        licenseType: "Import",
        holderName: "Test Holder",
        category: "Test",
        issueDate: new Date(),
        expiryDate: new Date(Date.now() + 400 * 86400000),
        productId: product.productId,
      },
    });
    createdLicenseIds.push(license.licenseId);

    await expect(
      prisma.$transaction(async (tx) => {
        await assertProductsNotBlockedTx(tx, [product.productId]);
      }),
    ).resolves.not.toThrow();
  });

  it("resolves immediately without querying when productIds is empty", async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        await assertProductsNotBlockedTx(tx, []);
      }),
    ).resolves.not.toThrow();
  });
});
