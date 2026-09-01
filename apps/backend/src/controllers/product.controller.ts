import { ProductModel } from "../models/product.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listProducts = asyncHandler(async (_req, res) => {
  res.json(await ProductModel.findAll());
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await ProductModel.findById(Number(req.params.id));
  if (!product) throw new HttpError(404, "Product not found");
  res.json(product);
});

export const createProduct = asyncHandler(async (req, res) => {
  const { productCode, productName, categoryId, supplierId, unit, stockQty, minStock, unitPrice, currency, status, description } =
    req.body;
  if (!productCode || !productName || !categoryId || !supplierId || !unit || unitPrice == null) {
    throw new HttpError(400, "productCode, productName, categoryId, supplierId, unit, and unitPrice are required");
  }
  res.status(201).json(
    await ProductModel.create({
      productCode,
      productName,
      categoryId: Number(categoryId),
      supplierId: Number(supplierId),
      unit,
      stockQty,
      minStock,
      unitPrice,
      currency,
      status,
      description,
    }),
  );
});

export const updateProduct = asyncHandler(async (req, res) => {
  const { productCode, productName, categoryId, supplierId, unit, stockQty, minStock, unitPrice, currency, status, description } =
    req.body;
  res.json(
    await ProductModel.update(Number(req.params.id), {
      productCode,
      productName,
      categoryId: categoryId != null ? Number(categoryId) : undefined,
      supplierId: supplierId != null ? Number(supplierId) : undefined,
      unit,
      stockQty,
      minStock,
      unitPrice,
      currency,
      status,
      description,
    }),
  );
});

export const deleteProduct = asyncHandler(async (req, res) => {
  await ProductModel.delete(Number(req.params.id));
  res.status(204).end();
});
