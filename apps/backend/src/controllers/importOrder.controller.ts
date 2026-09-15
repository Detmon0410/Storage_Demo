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
    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (qty <= 0) throw new HttpError(400, "quantity must be a positive number");
    if (price < 0) throw new HttpError(400, "unitPrice must not be negative");
    return {
      productId: Number(productId),
      quantity: qty,
      unitPrice: price,
      taxRate: taxRate == null ? 0 : Number(taxRate),
    };
  });
};

const IMPORT_STATUS_VALUES = ["STAGING", "PENDING_APPROVAL", "APPROVED", "CUSTOMS_CLEARED", "RECEIVED", "ISSUE", "REJECTED"];
const IMPORT_STATUS_PIPELINE: Record<string, number> = {
  STAGING: 0,
  PENDING_APPROVAL: 1,
  APPROVED: 2,
  CUSTOMS_CLEARED: 3,
  RECEIVED: 4,
  ISSUE: 5,
};

const assertValidImportStatusTransition = (newStatus: string, currentStatus?: string) => {
  if (!IMPORT_STATUS_VALUES.includes(newStatus)) {
    throw new HttpError(400, `invalid status "${newStatus}"; must be one of ${IMPORT_STATUS_VALUES.join(", ")}`);
  }
  if (currentStatus == null || currentStatus === newStatus) return;
  if (currentStatus === "REJECTED" || currentStatus === "ISSUE") {
    throw new HttpError(400, `invalid status transition: cannot change status from terminal state "${currentStatus}"`);
  }
  const fromIndex = IMPORT_STATUS_PIPELINE[currentStatus];
  const toIndex = IMPORT_STATUS_PIPELINE[newStatus];
  if (fromIndex != null && toIndex != null && toIndex < fromIndex) {
    throw new HttpError(400, `invalid status transition from "${currentStatus}" to "${newStatus}"`);
  }
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
  assertValidImportStatusTransition(status);
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

  if (status === "APPROVED" || status === "REJECTED") {
    throw new HttpError(400, "Use the dedicated approve/reject endpoint to change status to APPROVED or REJECTED");
  }

  const importOrderId = Number(req.params.id);
  const before = await ImportOrderModel.findById(importOrderId);
  if (!before) throw new HttpError(404, "Import order not found");

  if (status != null) {
    assertValidImportStatusTransition(status, before.status);
  }

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

export const approveImportOrder = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const importOrderId = Number(req.params.id);
  const order = await prisma.$transaction(async (tx) => {
    const existing = await tx.importOrder.findUnique({ where: { importOrderId } });
    if (!existing) throw new HttpError(404, "Import order not found");
    if (existing.createdById != null && existing.createdById === req.userId) {
      throw new HttpError(403, "You cannot approve an order you created");
    }
    const approverUser = await tx.user.findUnique({ where: { id: req.userId! }, select: { username: true } });
    const updated = await tx.importOrder.update({
      where: { importOrderId },
      data: { status: "APPROVED", approver: approverUser?.username ?? null },
    });
    await AuditLogModel.record(tx, {
      entity: "ImportOrder",
      entityId: importOrderId,
      action: "approve",
      userId: req.userId ?? null,
      before: existing,
      after: updated,
    });
    return updated;
  });
  res.json(order);
});

export const rejectImportOrder = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const importOrderId = Number(req.params.id);
  const order = await prisma.$transaction(async (tx) => {
    const existing = await tx.importOrder.findUnique({ where: { importOrderId } });
    if (!existing) throw new HttpError(404, "Import order not found");
    if (existing.createdById != null && existing.createdById === req.userId) {
      throw new HttpError(403, "You cannot reject an order you created");
    }
    const approverUser = await tx.user.findUnique({ where: { id: req.userId! }, select: { username: true } });
    const updated = await tx.importOrder.update({
      where: { importOrderId },
      data: { status: "REJECTED", approver: approverUser?.username ?? null },
    });
    await AuditLogModel.record(tx, {
      entity: "ImportOrder",
      entityId: importOrderId,
      action: "reject",
      userId: req.userId ?? null,
      before: existing,
      after: { ...updated, rejectionReason: req.body?.reason ?? null },
    });
    return updated;
  });
  res.json(order);
});
