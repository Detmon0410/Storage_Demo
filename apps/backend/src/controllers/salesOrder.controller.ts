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

const DELIVERY_STATUS_VALUES = ["PENDING", "SHIPPING", "DELIVERED", "RETURNED", "DAMAGED"];
const DELIVERY_PIPELINE: Record<string, number> = { PENDING: 0, SHIPPING: 1, DELIVERED: 2 };
const POST_DELIVERY_STATES = new Set(["DELIVERED", "RETURNED", "DAMAGED"]);

const assertValidDeliveryStatusTransition = (newStatus: string, currentStatus?: string) => {
  if (!DELIVERY_STATUS_VALUES.includes(newStatus)) {
    throw new HttpError(400, `invalid deliveryStatus "${newStatus}"; must be one of ${DELIVERY_STATUS_VALUES.join(", ")}`);
  }
  if (currentStatus == null || currentStatus === newStatus) return;
  if ((newStatus === "RETURNED" || newStatus === "DAMAGED") && !POST_DELIVERY_STATES.has(currentStatus)) {
    throw new HttpError(400, `invalid status transition: "${newStatus}" requires the order to already be DELIVERED`);
  }
  const fromIndex = DELIVERY_PIPELINE[currentStatus];
  const toIndex = DELIVERY_PIPELINE[newStatus];
  if (fromIndex != null && toIndex != null && toIndex < fromIndex) {
    throw new HttpError(400, `invalid status transition from "${currentStatus}" to "${newStatus}"`);
  }
};

// APPROVAL-01: the real 5-value approval machine, fully independent of deliveryStatus above.
// D-06: CANCELLED is only reachable from DRAFT or PENDING_APPROVAL.
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

export const listSalesOrders = asyncHandler(async (_req, res) => {
  res.json(await SalesOrderModel.findAll());
});

export const getSalesOrder = asyncHandler(async (req, res) => {
  const order = await SalesOrderModel.findById(Number(req.params.id));
  if (!order) throw new HttpError(404, "Sales order not found");
  res.json(order);
});

export const createSalesOrder = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { orderNo, customerId, customerLicenseId, deliveryStatus, invoiceNo, status, items } = req.body;
  if (!orderNo || !customerId || !deliveryStatus || !invoiceNo) {
    throw new HttpError(400, "orderNo, customerId, deliveryStatus, and invoiceNo are required");
  }
  if (!customerLicenseId) {
    throw new HttpError(400, "A valid customer license must be selected");
  }
  if (status != null) {
    throw new HttpError(400, "status is server-derived from credit/discount thresholds; use the dedicated approve/reject endpoint instead");
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
  const { orderNo, customerId, customerLicenseId, deliveryStatus, invoiceNo, status, items } = req.body;

  if (status != null) {
    throw new HttpError(400, "status is server-derived from credit/discount thresholds; use the dedicated approve/reject endpoint instead");
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
    if (existing.status === "PENDING_APPROVAL") {
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
    const updated = await tx.salesOrder.update({
      where: { salesOrderId },
      data: { status: "APPROVED", approvedById: req.userId, approvedAt: new Date() },
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
    const updated = await tx.salesOrder.update({
      where: { salesOrderId },
      data: {
        status: "REJECTED",
        approvedById: req.userId,
        approvedAt: new Date(),
        rejectionReason: req.body?.reason ?? null,
      },
    });
    await AuditLogModel.record(tx, {
      entity: "SalesOrder",
      entityId: salesOrderId,
      action: "reject",
      userId: req.userId ?? null,
      before: existing,
      after: updated,
    });
    return updated;
  });
  res.json(order);
});
