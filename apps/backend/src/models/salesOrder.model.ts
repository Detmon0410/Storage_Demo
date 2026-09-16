import type { PrismaClient, Prisma, OrderStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import { assertProductsNotBlockedTx } from "../utils/licenseGate.js";
import { isLicenseValid } from "./customerLicense.model.js";
import { createStockTransactionTx, reverseAndDeleteByReferenceTx } from "./stockTransaction.model.js";
import { salesOrderStockReference } from "../utils/stockReference.js";
import { assertLotQuantityTx } from "../utils/lotGate.js";
import { assertCreditAndDiscountTx } from "../utils/creditDiscountGate.js";

type Client = PrismaClient | Prisma.TransactionClient;

const withRelations = {
  customer: true,
  customerLicense: true,
  items: { include: { product: true } },
} as const;

export interface SalesOrderItemInput {
  productId: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate?: number;
  inventoryStockId: number;
}

const toItemRows = (items: SalesOrderItemInput[]) =>
  items.map((item) => {
    const taxRate = item.taxRate ?? 0;
    const discounted = item.quantity * item.unitPrice * (1 - item.discount / 100);
    const taxAmount = discounted * (taxRate / 100);
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      taxRate,
      taxAmount,
      inventoryStockId: item.inventoryStockId,
      netValue: discounted + taxAmount,
    };
  });

const orderTotals = (rows: ReturnType<typeof toItemRows>) => {
  const taxTotal = rows.reduce((sum, row) => sum + row.taxAmount, 0);
  const netValue = rows.reduce((sum, row) => sum + row.netValue, 0);
  return { taxTotal, netValue };
};

const createStockOutTx = async (tx: Prisma.TransactionClient, orderNo: string, items: SalesOrderItemInput[]) => {
  const referenceNo = salesOrderStockReference(orderNo);
  for (const [index, item] of items.entries()) {
    await createStockTransactionTx(tx, {
      transactionNo: `${referenceNo}-${index + 1}`,
      productId: item.productId,
      transactionType: "OUT",
      quantity: item.quantity,
      referenceNo,
      inventoryStockId: item.inventoryStockId,
      note: `Auto-generated from sales order ${orderNo}`,
    });
  }
};

const applyLotGuardsTx = async (tx: Prisma.TransactionClient, customerId: number, items: SalesOrderItemInput[]) => {
  // ENFORCE-02: hard reject regardless of approval outcome — a line that exceeds its lot's
  // availability is always rejected, whether or not the order also requires approval.
  await assertLotQuantityTx(tx, items.map((i) => ({ inventoryStockId: i.inventoryStockId, quantity: i.quantity })));
  // ENFORCE-03/ENFORCE-04: soft-block — never throws, just tells the caller whether to defer
  // the stock decrement and flag the order for approval.
  return assertCreditAndDiscountTx(tx, customerId, items);
};

const validateAndSnapshotLicense = async (tx: Prisma.TransactionClient, customerId: number, customerLicenseId: number) => {
  const license = await tx.customerLicense.findUnique({ where: { customerLicenseId } });
  if (!license) throw new HttpError(400, "Selected customer license not found");
  if (license.customerId !== customerId) throw new HttpError(400, "Selected license does not belong to this customer");
  if (!isLicenseValid(license)) throw new HttpError(400, "Selected license is not active or has expired");
  return {
    customerLicenseId: license.customerLicenseId,
    licenseNumberSnapshot: license.licenseNumber,
    licenseTypeSnapshot: license.licenseType,
    licenseExpirySnapshot: license.expiryDate,
  };
};

export const SalesOrderModel = {
  findAll: () =>
    prisma.salesOrder.findMany({
      orderBy: { salesOrderId: "asc" },
      include: withRelations,
    }),

  findById: (salesOrderId: number) =>
    prisma.salesOrder.findUnique({
      where: { salesOrderId },
      include: withRelations,
    }),

  create: (
    data: {
      orderNo: string;
      customerId: number;
      customerLicenseId: number;
      deliveryStatus: string;
      invoiceNo: string;
      items: SalesOrderItemInput[];
      createdById?: number;
    },
    client: Client = prisma,
  ) => {
    const rows = toItemRows(data.items);
    const run = async (tx: Client) => {
      await assertProductsNotBlockedTx(tx as Prisma.TransactionClient, data.items.map((i) => i.productId));
      const licenseFields = await validateAndSnapshotLicense(tx as Prisma.TransactionClient, data.customerId, data.customerLicenseId);
      const { requiresApproval } = await applyLotGuardsTx(tx as Prisma.TransactionClient, data.customerId, data.items);
      const status: OrderStatus = requiresApproval ? "PENDING_APPROVAL" : "APPROVED";

      const order = await tx.salesOrder.create({
        data: {
          orderNo: data.orderNo,
          customerId: data.customerId,
          deliveryStatus: data.deliveryStatus,
          invoiceNo: data.invoiceNo,
          ...orderTotals(rows),
          items: { create: rows },
          ...licenseFields,
          createdById: data.createdById,
          status,
        },
        include: withRelations,
      });
      // APPROVAL-02/03: stock decrements exactly at the moment an order's status is APPROVED —
      // never at creation time for an order that requires approval. Deferred decrement happens
      // in salesOrder.controller.ts's approveSalesOrder when it later transitions to APPROVED.
      if (status === "APPROVED") {
        await createStockOutTx(tx as Prisma.TransactionClient, data.orderNo, data.items);
      }
      return order;
    };
    return "$transaction" in client ? client.$transaction((tx) => run(tx)) : run(client);
  },

  update: (
    salesOrderId: number,
    data: Partial<{
      orderNo: string;
      customerId: number;
      customerLicenseId: number;
      deliveryStatus: string;
      invoiceNo: string;
      items: SalesOrderItemInput[];
      updatedById: number;
    }>,
    client: Client = prisma,
  ) => {
    const { items, customerLicenseId, ...orderFields } = data;

    const run = async (tx: Client): Promise<unknown> => {
      if (!items) {
        let licenseFields = {};
        if (customerLicenseId != null) {
          const existing = await tx.salesOrder.findUnique({ where: { salesOrderId }, select: { customerId: true } });
          if (!existing) throw new HttpError(404, "Sales order not found");
          const customerId = data.customerId ?? existing.customerId;
          licenseFields = await validateAndSnapshotLicense(tx as Prisma.TransactionClient, customerId, customerLicenseId);
        }
        return tx.salesOrder.update({
          where: { salesOrderId },
          data: { ...orderFields, ...licenseFields, updatedById: data.updatedById },
          include: withRelations,
        });
      }

      const rows = toItemRows(items);
      await assertProductsNotBlockedTx(tx as Prisma.TransactionClient, items.map((i) => i.productId));
      const existing = await tx.salesOrder.findUnique({ where: { salesOrderId }, select: { orderNo: true, customerId: true } });
      if (!existing) throw new HttpError(404, "Sales order not found");

      await reverseAndDeleteByReferenceTx(tx as Prisma.TransactionClient, salesOrderStockReference(existing.orderNo));
      await tx.salesOrderItem.deleteMany({ where: { salesOrderId } });

      let licenseFields = {};
      if (customerLicenseId != null) {
        const customerId = data.customerId ?? existing.customerId;
        licenseFields = await validateAndSnapshotLicense(tx as Prisma.TransactionClient, customerId, customerLicenseId);
      }

      const customerId = data.customerId ?? existing.customerId;
      const { requiresApproval } = await applyLotGuardsTx(tx as Prisma.TransactionClient, customerId, items);
      const status: OrderStatus = requiresApproval ? "PENDING_APPROVAL" : "APPROVED";

      const updated = await tx.salesOrder.update({
        where: { salesOrderId },
        data: {
          ...orderFields,
          ...licenseFields,
          ...orderTotals(rows),
          items: { create: rows },
          status,
          updatedById: data.updatedById,
        },
        include: withRelations,
      });

      const orderNo = data.orderNo ?? existing.orderNo;
      if (status === "APPROVED") {
        await createStockOutTx(tx as Prisma.TransactionClient, orderNo, items);
      }
      return updated;
    };
    return "$transaction" in client ? client.$transaction((tx) => run(tx)) : run(client);
  },

  delete: (salesOrderId: number, client: Client = prisma) => {
    const run = async (tx: Client) => {
      const existing = await tx.salesOrder.findUnique({ where: { salesOrderId }, select: { orderNo: true } });
      if (!existing) throw new HttpError(404, "Sales order not found");

      await reverseAndDeleteByReferenceTx(tx as Prisma.TransactionClient, salesOrderStockReference(existing.orderNo));
      return tx.salesOrder.delete({ where: { salesOrderId } });
    };
    return "$transaction" in client ? client.$transaction((tx) => run(tx)) : run(client);
  },
};
