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

// D-02: logistics-only pipeline, fresh indices (no PENDING_APPROVAL/APPROVED — those moved to the
// new OrderStatus `status` field below).
const LOGISTICS_STATUS_VALUES = ["STAGING", "CUSTOMS_CLEARED", "RECEIVED", "ISSUE"];
const LOGISTICS_PIPELINE: Record<string, number> = { STAGING: 0, CUSTOMS_CLEARED: 1, RECEIVED: 2 };

const assertValidLogisticsStatusTransition = (newStatus: string, currentStatus?: string) => {
  if (!LOGISTICS_STATUS_VALUES.includes(newStatus)) {
    throw new HttpError(400, `invalid logisticsStatus "${newStatus}"; must be one of ${LOGISTICS_STATUS_VALUES.join(", ")}`);
  }
  if (currentStatus == null || currentStatus === newStatus) return;
  if (currentStatus === "ISSUE") {
    throw new HttpError(400, `invalid status transition: cannot change logisticsStatus from terminal state "${currentStatus}"`);
  }
  const fromIndex = LOGISTICS_PIPELINE[currentStatus];
  const toIndex = LOGISTICS_PIPELINE[newStatus];
  if (fromIndex != null && toIndex != null && toIndex < fromIndex) {
    throw new HttpError(400, `invalid logisticsStatus transition from "${currentStatus}" to "${newStatus}"`);
  }
};

// APPROVAL-01: the real 5-value approval machine, shared shape with salesOrder.controller.ts (kept
// as a separate per-file declaration, matching this codebase's existing per-controller duplication
// style for status-value arrays).
const ORDER_STATUS_VALUES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"];
const assertValidOrderStatusTransition = (newStatus: string, currentStatus?: string) => {
  if (!ORDER_STATUS_VALUES.includes(newStatus)) {
    throw new HttpError(400, `invalid status "${newStatus}"; must be one of ${ORDER_STATUS_VALUES.join(", ")}`);
  }
  if (currentStatus === "APPROVED" || currentStatus === "REJECTED" || currentStatus === "CANCELLED") {
    throw new HttpError(400, `invalid status transition: cannot change status from terminal state "${currentStatus}"`);
  }
  if (newStatus === "CANCELLED" && !["DRAFT", "PENDING_APPROVAL"].includes(currentStatus ?? "DRAFT")) {
    throw new HttpError(400, "CANCELLED is only reachable from DRAFT or PENDING_APPROVAL");
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
  const { orderNo, supplierId, country, incoterms, orderDate, etaDate, logisticsStatus, status, customsEntryNo, items } =
    req.body;
  if (!orderNo || !supplierId || !country || !incoterms || !orderDate || !etaDate || !logisticsStatus) {
    throw new HttpError(400, "orderNo, supplierId, country, incoterms, orderDate, etaDate, and logisticsStatus are required");
  }
  if (status != null) {
    throw new HttpError(400, "status is server-derived from the import value threshold; use the dedicated approve/reject endpoint instead");
  }
  assertValidLogisticsStatusTransition(logisticsStatus);
  const order = await prisma.$transaction(async (tx) => {
    const created = await ImportOrderModel.create(
      {
        orderNo,
        supplierId: Number(supplierId),
        country,
        incoterms,
        orderDate: new Date(orderDate),
        etaDate: new Date(etaDate),
        logisticsStatus,
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
  const { orderNo, supplierId, country, incoterms, orderDate, etaDate, logisticsStatus, status, customsEntryNo, items } =
    req.body;

  if (status != null) {
    throw new HttpError(400, "status is server-derived from the import value threshold; use the dedicated approve/reject endpoint instead");
  }

  const importOrderId = Number(req.params.id);
  const before = await ImportOrderModel.findById(importOrderId);
  if (!before) throw new HttpError(404, "Import order not found");

  if (logisticsStatus != null) {
    assertValidLogisticsStatusTransition(logisticsStatus, before.logisticsStatus);
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
        logisticsStatus,
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
    const updated = await tx.importOrder.update({
      where: { importOrderId },
      data: { status: "APPROVED", approvedById: req.userId, approvedAt: new Date() },
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
    const updated = await tx.importOrder.update({
      where: { importOrderId },
      data: {
        status: "REJECTED",
        approvedById: req.userId,
        approvedAt: new Date(),
        rejectionReason: req.body?.reason ?? null,
      },
    });
    await AuditLogModel.record(tx, {
      entity: "ImportOrder",
      entityId: importOrderId,
      action: "reject",
      userId: req.userId ?? null,
      before: existing,
      after: updated,
    });
    return updated;
  });
  res.json(order);
});
