import { prisma } from "../lib/prisma.js";
import { AuditLogModel } from "../lib/audit.js";
import { ImportOrderModel, type ImportOrderItemInput } from "../models/importOrder.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const optionalDate = (value: unknown) => (value == null ? undefined : new Date(String(value)));
const optionalNumber = (value: unknown) => (value == null ? undefined : Number(value));

const parseItems = (value: unknown): ImportOrderItemInput[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(400, "items must be a non-empty array of { productId, quantity, unitPrice }");
  }
  return value.map((raw) => {
    const { productId, quantity, unitPrice, taxRate } = raw as Record<string, unknown>;
    if (productId == null || quantity == null || unitPrice == null) {
      throw new HttpError(400, "each item requires productId, quantity, and unitPrice");
    }
    return {
      productId: Number(productId),
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      taxRate: taxRate == null ? 0 : Number(taxRate),
    };
  });
};

export const listImportOrders = asyncHandler(async (_req, res) => {
  res.json(await ImportOrderModel.findAll());
});

export const getImportOrder = asyncHandler(async (req, res) => {
  const order = await ImportOrderModel.findById(Number(req.params.id));
  if (!order) throw new HttpError(404, "Import order not found");
  res.json(order);
});

export const createImportOrder = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { orderNo, supplierId, country, incoterms, orderDate, etaDate, status, approver, customsEntryNo, items } =
    req.body;
  if (!orderNo || !supplierId || !country || !incoterms || !orderDate || !etaDate || !status) {
    throw new HttpError(400, "orderNo, supplierId, country, incoterms, orderDate, etaDate, and status are required");
  }
  const order = await prisma.$transaction(async (tx) => {
    const created = await ImportOrderModel.create(
      {
        orderNo,
        supplierId: Number(supplierId),
        country,
        incoterms,
        orderDate: new Date(orderDate),
        etaDate: new Date(etaDate),
        status,
        approver,
        customsEntryNo,
        items: parseItems(items),
        createdById: req.userId,
      },
      tx,
    );
    await AuditLogModel.record(tx, {
      entity: "ImportOrder",
      entityId: created.importOrderId,
      action: "create",
      userId: req.userId ?? null,
      before: null,
      after: created,
    });
    return created;
  });
  res.status(201).json(order);
});

export const updateImportOrder = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { orderNo, supplierId, country, incoterms, orderDate, etaDate, status, approver, customsEntryNo, items } =
    req.body;

  const importOrderId = Number(req.params.id);
  const before = await ImportOrderModel.findById(importOrderId);
  if (!before) throw new HttpError(404, "Import order not found");

  const order = await prisma.$transaction(async (tx) => {
    const updated = await ImportOrderModel.update(
      importOrderId,
      {
        orderNo,
        supplierId: optionalNumber(supplierId),
        country,
        incoterms,
        orderDate: optionalDate(orderDate),
        etaDate: optionalDate(etaDate),
        status,
        approver,
        customsEntryNo,
        items: items == null ? undefined : parseItems(items),
      },
      tx,
    );
    await AuditLogModel.record(tx, {
      entity: "ImportOrder",
      entityId: importOrderId,
      action: "update",
      userId: req.userId ?? null,
      before,
      after: updated,
    });
    return updated;
  });
  res.json(order);
});

export const deleteImportOrder = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const importOrderId = Number(req.params.id);
  const before = await ImportOrderModel.findById(importOrderId);
  if (!before) throw new HttpError(404, "Import order not found");

  await prisma.$transaction(async (tx) => {
    await ImportOrderModel.delete(importOrderId, tx);
    await AuditLogModel.record(tx, {
      entity: "ImportOrder",
      entityId: importOrderId,
      action: "delete",
      userId: req.userId ?? null,
      before,
      after: null,
    });
  });
  res.status(204).end();
});
