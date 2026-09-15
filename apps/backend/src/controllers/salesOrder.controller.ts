import { prisma } from "../lib/prisma.js";
import { AuditLogModel } from "../lib/audit.js";
import { SalesOrderModel, type SalesOrderItemInput } from "../models/salesOrder.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";
import { assertLotQuantityTx } from "../utils/lotGate.js";
import { createStockTransactionTx } from "../models/stockTransaction.model.js";
import { salesOrderStockReference } from "../utils/stockReference.js";

const parseItems = (value: unknown): SalesOrderItemInput[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(400, "items must be a non-empty array of { productId, quantity, unitPrice, discount, inventoryStockId }");
  }
  return value.map((raw) => {
    const { productId, quantity, unitPrice, discount, taxRate, inventoryStockId } = raw as Record<string, unknown>;
    if (productId == null || quantity == null || unitPrice == null || discount == null || !inventoryStockId) {
      throw new HttpError(400, "each item requires productId, quantity, unitPrice, discount, and inventoryStockId");
    }
    const qty = Number(quantity);
    const price = Number(unitPrice);
    const disc = Number(discount);
    if (qty <= 0) throw new HttpError(400, "quantity must be a positive number");
    if (price < 0) throw new HttpError(400, "unitPrice must not be negative");
    if (disc < 0 || disc > 100) throw new HttpError(400, "discount must be between 0 and 100");
    return {
      productId: Number(productId),
      quantity: qty,
      unitPrice: price,
      discount: disc,
      taxRate: taxRate == null ? 0 : Number(taxRate),
      inventoryStockId: Number(inventoryStockId),
    };
  });
};

const DELIVERY_STATUS_VALUES = ["PENDING", "SHIPPING", "DELIVERED", "RETURNED", "DAMAGED", "APPROVED", "REJECTED"];
const DELIVERY_PIPELINE: Record<string, number> = { PENDING: 0, SHIPPING: 1, DELIVERED: 2 };
const POST_DELIVERY_STATES = new Set(["DELIVERED", "RETURNED", "DAMAGED"]);

const assertValidDeliveryStatusTransition = (newStatus: string, currentStatus?: string) => {
  if (!DELIVERY_STATUS_VALUES.includes(newStatus)) {
    throw new HttpError(400, `invalid deliveryStatus "${newStatus}"; must be one of ${DELIVERY_STATUS_VALUES.join(", ")}`);
  }
  if (currentStatus == null || currentStatus === newStatus) return;
  if (currentStatus === "APPROVED" || currentStatus === "REJECTED") {
    throw new HttpError(400, `invalid status transition: cannot change deliveryStatus from terminal state "${currentStatus}"`);
  }
  if ((newStatus === "RETURNED" || newStatus === "DAMAGED") && !POST_DELIVERY_STATES.has(currentStatus)) {
    throw new HttpError(400, `invalid status transition: "${newStatus}" requires the order to already be DELIVERED`);
  }
  const fromIndex = DELIVERY_PIPELINE[currentStatus];
  const toIndex = DELIVERY_PIPELINE[newStatus];
  if (fromIndex != null && toIndex != null && toIndex < fromIndex) {
    throw new HttpError(400, `invalid status transition from "${currentStatus}" to "${newStatus}"`);
  }
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
  if (deliveryStatus === "APPROVED" || deliveryStatus === "REJECTED") {
    throw new HttpError(400, "Use the dedicated approve/reject endpoint to change status to APPROVED or REJECTED");
  }
  assertValidDeliveryStatusTransition(deliveryStatus);
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

  if (deliveryStatus === "APPROVED" || deliveryStatus === "REJECTED") {
    throw new HttpError(400, "Use the dedicated approve/reject endpoint to change status to APPROVED or REJECTED");
  }

  const salesOrderId = Number(req.params.id);
  const before = await SalesOrderModel.findById(salesOrderId);
  if (!before) throw new HttpError(404, "Sales order not found");

  if (deliveryStatus != null) {
    assertValidDeliveryStatusTransition(deliveryStatus, before.deliveryStatus);
  }

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
        updatedById: req.userId,
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
    if (existing.updatedById != null && existing.updatedById === req.userId) {
      throw new HttpError(403, "You cannot approve an order you last edited");
    }
    if (existing.requiresApproval) {
      const items = await tx.salesOrderItem.findMany({ where: { salesOrderId } });
      await assertLotQuantityTx(tx, items.map((i) => ({ inventoryStockId: i.inventoryStockId, quantity: i.quantity })));
      const referenceNo = salesOrderStockReference(existing.orderNo);
      for (const [index, item] of items.entries()) {
        await createStockTransactionTx(tx, {
          transactionNo: `${referenceNo}-${index + 1}`,
          productId: item.productId,
          transactionType: "OUT",
          quantity: item.quantity,
          referenceNo,
          inventoryStockId: item.inventoryStockId,
          note: `Auto-generated from sales order ${existing.orderNo} (approved)`,
        });
      }
    }
    const approverUser = await tx.user.findUnique({ where: { id: req.userId! }, select: { username: true } });
    const updated = await tx.salesOrder.update({
      where: { salesOrderId },
      data: { deliveryStatus: "APPROVED", approver: approverUser?.username ?? null, requiresApproval: false },
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
    if (existing.updatedById != null && existing.updatedById === req.userId) {
      throw new HttpError(403, "You cannot reject an order you last edited");
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
