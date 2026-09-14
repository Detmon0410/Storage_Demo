import { prisma } from "../lib/prisma.js";
import { AuditLogModel } from "../lib/audit.js";
import { InventoryStockModel } from "../models/inventoryStock.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

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

export const createInventoryStock = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { productId, importOrderItemId, lotBatch, receivedDate, quantityOnHand, stockAgeDays, stockStatus, warehouse } =
    req.body;
  if (!productId || !lotBatch || !receivedDate || quantityOnHand == null || stockAgeDays == null || !stockStatus || !warehouse) {
    throw new HttpError(400, "productId, lotBatch, receivedDate, quantityOnHand, stockAgeDays, stockStatus, and warehouse are required");
  }
  const stock = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryStock.create({
      data: {
        productId: Number(productId),
        importOrderItemId: optionalNullableNumber(importOrderItemId),
        lotBatch,
        receivedDate: new Date(receivedDate),
        quantityOnHand: Number(quantityOnHand),
        stockAgeDays: Number(stockAgeDays),
        stockStatus,
        warehouse,
      },
    });
    await AuditLogModel.record(tx, {
      entity: "InventoryStock",
      entityId: created.inventoryStockId,
      action: "create",
      userId: req.userId ?? null,
      before: null,
      after: created,
    });
    return created;
  });
  res.status(201).json(stock);
});

export const updateInventoryStock = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { productId, importOrderItemId, lotBatch, receivedDate, quantityOnHand, stockAgeDays, stockStatus, warehouse } =
    req.body;
  const stock = await prisma.$transaction(async (tx) => {
    const before = await tx.inventoryStock.findUnique({ where: { inventoryStockId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "Inventory stock not found");
    const after = await tx.inventoryStock.update({
      where: { inventoryStockId: Number(req.params.id) },
      data: {
        productId: optionalNumber(productId),
        importOrderItemId: importOrderItemId === undefined ? undefined : optionalNullableNumber(importOrderItemId),
        lotBatch,
        receivedDate: optionalDate(receivedDate),
        quantityOnHand: optionalNumber(quantityOnHand),
        stockAgeDays: optionalNumber(stockAgeDays),
        stockStatus,
        warehouse,
      },
    });
    await AuditLogModel.record(tx, {
      entity: "InventoryStock",
      entityId: after.inventoryStockId,
      action: "update",
      userId: req.userId ?? null,
      before,
      after,
    });
    return after;
  });
  res.json(stock);
});

export const deleteInventoryStock = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await prisma.$transaction(async (tx) => {
    const before = await tx.inventoryStock.findUnique({ where: { inventoryStockId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "Inventory stock not found");
    await tx.inventoryStock.delete({ where: { inventoryStockId: Number(req.params.id) } });
    await AuditLogModel.record(tx, {
      entity: "InventoryStock",
      entityId: before.inventoryStockId,
      action: "delete",
      userId: req.userId ?? null,
      before,
      after: null,
    });
  });
  res.status(204).end();
});
