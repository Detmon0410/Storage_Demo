import { prisma } from "../lib/prisma.js";
import { AuditLogModel } from "../lib/audit.js";
import { SalesOrderModel, type SalesOrderItemInput } from "../models/salesOrder.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const parseItems = (value: unknown): SalesOrderItemInput[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(400, "items must be a non-empty array of { productId, quantity, unitPrice, discount, lotBatch }");
  }
  return value.map((raw) => {
    const { productId, quantity, unitPrice, discount, taxRate, lotBatch } = raw as Record<string, unknown>;
    if (productId == null || quantity == null || unitPrice == null || discount == null || !lotBatch) {
      throw new HttpError(400, "each item requires productId, quantity, unitPrice, discount, and lotBatch");
    }
    return {
      productId: Number(productId),
      quantity: Number(quantity),
      unitPrice: Number(unitPrice),
      discount: Number(discount),
      taxRate: taxRate == null ? 0 : Number(taxRate),
      lotBatch: String(lotBatch),
    };
  });
};

export const listSalesOrders = asyncHandler(async (_req, res) => {
  res.json(await SalesOrderModel.findAll());
});

export const getSalesOrder = asyncHandler(async (req, res) => {
  const order = await SalesOrderModel.findById(Number(req.params.id));
  if (!order) throw new HttpError(404, "Sales order not found");
  res.json(order);
});

export const createSalesOrder = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { orderNo, customerId, customerLicenseId, deliveryStatus, invoiceNo, approver, items } = req.body;
  if (!orderNo || !customerId || !deliveryStatus || !invoiceNo) {
    throw new HttpError(400, "orderNo, customerId, deliveryStatus, and invoiceNo are required");
  }
  if (!customerLicenseId) {
    throw new HttpError(400, "A valid customer license must be selected");
  }
  const order = await prisma.$transaction(async (tx) => {
    const created = await SalesOrderModel.create(
      {
        orderNo,
        customerId: Number(customerId),
        customerLicenseId: Number(customerLicenseId),
        deliveryStatus,
        invoiceNo,
        approver,
        items: parseItems(items),
        createdById: req.userId,
      },
      tx,
    );
    await AuditLogModel.record(tx, {
      entity: "SalesOrder",
      entityId: created.salesOrderId,
      action: "create",
      userId: req.userId ?? null,
      before: null,
      after: created,
    });
    return created;
  });
  res.status(201).json(order);
});

export const updateSalesOrder = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { orderNo, customerId, customerLicenseId, deliveryStatus, invoiceNo, approver, items } = req.body;

  const salesOrderId = Number(req.params.id);
  const before = await SalesOrderModel.findById(salesOrderId);
  if (!before) throw new HttpError(404, "Sales order not found");

  const order = await prisma.$transaction(async (tx) => {
    const updated = await SalesOrderModel.update(
      salesOrderId,
      {
        orderNo,
        customerId: customerId == null ? undefined : Number(customerId),
        customerLicenseId: customerLicenseId == null ? undefined : Number(customerLicenseId),
        deliveryStatus,
        invoiceNo,
        approver,
        items: items == null ? undefined : parseItems(items),
      },
      tx,
    );
    await AuditLogModel.record(tx, {
      entity: "SalesOrder",
      entityId: salesOrderId,
      action: "update",
      userId: req.userId ?? null,
      before,
      after: updated,
    });
    return updated;
  });
  res.json(order);
});

export const deleteSalesOrder = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const salesOrderId = Number(req.params.id);
  const before = await SalesOrderModel.findById(salesOrderId);
  if (!before) throw new HttpError(404, "Sales order not found");

  await prisma.$transaction(async (tx) => {
    await SalesOrderModel.delete(salesOrderId, tx);
    await AuditLogModel.record(tx, {
      entity: "SalesOrder",
      entityId: salesOrderId,
      action: "delete",
      userId: req.userId ?? null,
      before,
      after: null,
    });
  });
  res.status(204).end();
});

export const approveSalesOrder = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const salesOrderId = Number(req.params.id);
  const order = await prisma.$transaction(async (tx) => {
    const existing = await tx.salesOrder.findUnique({ where: { salesOrderId } });
    if (!existing) throw new HttpError(404, "Sales order not found");
    if (existing.createdById != null && existing.createdById === req.userId) {
      throw new HttpError(403, "You cannot approve an order you created");
    }
    const approverUser = await tx.user.findUnique({ where: { id: req.userId! }, select: { username: true } });
    const updated = await tx.salesOrder.update({
      where: { salesOrderId },
      data: { deliveryStatus: "APPROVED", approver: approverUser?.username ?? null },
    });
    await AuditLogModel.record(tx, {
      entity: "SalesOrder",
      entityId: salesOrderId,
      action: "approve",
      userId: req.userId ?? null,
      before: existing,
      after: updated,
    });
    return updated;
  });
  res.json(order);
});

export const rejectSalesOrder = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const salesOrderId = Number(req.params.id);
  const order = await prisma.$transaction(async (tx) => {
    const existing = await tx.salesOrder.findUnique({ where: { salesOrderId } });
    if (!existing) throw new HttpError(404, "Sales order not found");
    if (existing.createdById != null && existing.createdById === req.userId) {
      throw new HttpError(403, "You cannot reject an order you created");
    }
    const approverUser = await tx.user.findUnique({ where: { id: req.userId! }, select: { username: true } });
    const updated = await tx.salesOrder.update({
      where: { salesOrderId },
      data: { deliveryStatus: "REJECTED", approver: approverUser?.username ?? null },
    });
    await AuditLogModel.record(tx, {
      entity: "SalesOrder",
      entityId: salesOrderId,
      action: "reject",
      userId: req.userId ?? null,
      before: existing,
      after: { ...updated, rejectionReason: req.body?.reason ?? null },
    });
    return updated;
  });
  res.json(order);
});
