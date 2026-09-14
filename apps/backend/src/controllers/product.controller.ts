import { prisma } from "../lib/prisma.js";
import { AuditLogModel } from "../lib/audit.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { ProductModel } from "../models/product.model.js";

export const listProducts = asyncHandler(async (_req, res) => {
  res.json(await ProductModel.findAll());
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await ProductModel.findById(Number(req.params.id));
  if (!product) throw new HttpError(404, "Product not found");
  res.json(product);
});

export const createProduct = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const {
    productCode,
    productName,
    categoryId,
    supplierId,
    unit,
    stockQty,
    minStock,
    unitPrice,
    costPrice,
    suggestedPrice,
    abvPercent,
    packageSizeMl,
    currency,
    status,
    description,
  } = req.body;
  if (!productCode || !productName || !categoryId || !supplierId || !unit || unitPrice == null) {
    throw new HttpError(400, "productCode, productName, categoryId, supplierId, unit, and unitPrice are required");
  }
  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        productCode,
        productName,
        categoryId: Number(categoryId),
        supplierId: Number(supplierId),
        unit,
        stockQty,
        minStock,
        unitPrice,
        costPrice,
        suggestedPrice,
        abvPercent,
        packageSizeMl,
        currency,
        status,
        description,
      },
    });
    await AuditLogModel.record(tx, {
      entity: "Product",
      entityId: created.productId,
      action: "create",
      userId: req.userId ?? null,
      before: null,
      after: created,
    });
    return created;
  });
  res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const {
    productCode,
    productName,
    categoryId,
    supplierId,
    unit,
    stockQty,
    minStock,
    unitPrice,
    costPrice,
    suggestedPrice,
    abvPercent,
    packageSizeMl,
    currency,
    status,
    description,
  } = req.body;
  const product = await prisma.$transaction(async (tx) => {
    const before = await tx.product.findUnique({ where: { productId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "Product not found");
    const after = await tx.product.update({
      where: { productId: Number(req.params.id) },
      data: {
        productCode,
        productName,
        categoryId: categoryId != null ? Number(categoryId) : undefined,
        supplierId: supplierId != null ? Number(supplierId) : undefined,
        unit,
        stockQty,
        minStock,
        unitPrice,
        costPrice,
        suggestedPrice,
        abvPercent,
        packageSizeMl,
        currency,
        status,
        description,
      },
    });
    await AuditLogModel.record(tx, {
      entity: "Product",
      entityId: after.productId,
      action: "update",
      userId: req.userId ?? null,
      before,
      after,
    });
    return after;
  });
  res.json(product);
});

export const deleteProduct = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await prisma.$transaction(async (tx) => {
    const before = await tx.product.findUnique({ where: { productId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "Product not found");
    await tx.product.delete({ where: { productId: Number(req.params.id) } });
    await AuditLogModel.record(tx, {
      entity: "Product",
      entityId: before.productId,
      action: "delete",
      userId: req.userId ?? null,
      before,
      after: null,
    });
  });
  res.status(204).end();
});
