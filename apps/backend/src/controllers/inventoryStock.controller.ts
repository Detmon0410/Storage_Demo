import { InventoryStockModel } from "../models/inventoryStock.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const optionalDate = (value: unknown) => (value == null ? undefined : new Date(String(value)));
const optionalNumber = (value: unknown) => (value == null ? undefined : Number(value));
const optionalNullableNumber = (value: unknown) => (value == null || value === "" ? null : Number(value));

export const listInventoryStocks = asyncHandler(async (_req, res) => {
  res.json(await InventoryStockModel.findAll());
});

export const getInventoryStock = asyncHandler(async (req, res) => {
  const stock = await InventoryStockModel.findById(Number(req.params.id));
  if (!stock) throw new HttpError(404, "Inventory stock not found");
  res.json(stock);
});

export const createInventoryStock = asyncHandler(async (req, res) => {
  const { productId, importOrderItemId, lotBatch, receivedDate, quantityOnHand, stockAgeDays, stockStatus, warehouse } =
    req.body;
  if (!productId || !lotBatch || !receivedDate || quantityOnHand == null || stockAgeDays == null || !stockStatus || !warehouse) {
    throw new HttpError(400, "productId, lotBatch, receivedDate, quantityOnHand, stockAgeDays, stockStatus, and warehouse are required");
  }
  res.status(201).json(
    await InventoryStockModel.create({
      productId: Number(productId),
      importOrderItemId: optionalNullableNumber(importOrderItemId),
      lotBatch,
      receivedDate: new Date(receivedDate),
      quantityOnHand: Number(quantityOnHand),
      stockAgeDays: Number(stockAgeDays),
      stockStatus,
      warehouse,
    }),
  );
});

export const updateInventoryStock = asyncHandler(async (req, res) => {
  const { productId, importOrderItemId, lotBatch, receivedDate, quantityOnHand, stockAgeDays, stockStatus, warehouse } =
    req.body;
  res.json(
    await InventoryStockModel.update(Number(req.params.id), {
      productId: optionalNumber(productId),
      importOrderItemId: importOrderItemId === undefined ? undefined : optionalNullableNumber(importOrderItemId),
      lotBatch,
      receivedDate: optionalDate(receivedDate),
      quantityOnHand: optionalNumber(quantityOnHand),
      stockAgeDays: optionalNumber(stockAgeDays),
      stockStatus,
      warehouse,
    }),
  );
});

export const deleteInventoryStock = asyncHandler(async (req, res) => {
  await InventoryStockModel.delete(Number(req.params.id));
  res.status(204).end();
});
