import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import { isLicenseValid } from "./customerLicense.model.js";
import { createStockTransactionTx, reverseAndDeleteByReferenceTx } from "./stockTransaction.model.js";
import { salesOrderStockReference } from "../utils/stockReference.js";

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
  lotBatch: string;
}

const toItemRows = (items: SalesOrderItemInput[]) =>
  items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount,
    lotBatch: item.lotBatch,
    netValue: item.quantity * item.unitPrice * (1 - item.discount / 100),
  }));

const createStockOutTx = async (tx: Prisma.TransactionClient, orderNo: string, items: SalesOrderItemInput[]) => {
  const referenceNo = salesOrderStockReference(orderNo);
  for (const [index, item] of items.entries()) {
    await createStockTransactionTx(tx, {
      transactionNo: `${referenceNo}-${index + 1}`,
      productId: item.productId,
      transactionType: "OUT",
      quantity: item.quantity,
      referenceNo,
      note: `Auto-generated from sales order ${orderNo}`,
    });
  }
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

  create: (data: {
    orderNo: string;
    customerId: number;
    customerLicenseId: number;
    deliveryStatus: string;
    invoiceNo: string;
    approver?: string;
    items: SalesOrderItemInput[];
  }) => {
    const rows = toItemRows(data.items);
    return prisma.$transaction(async (tx) => {
      const licenseFields = await validateAndSnapshotLicense(tx, data.customerId, data.customerLicenseId);

      const order = await tx.salesOrder.create({
        data: {
          orderNo: data.orderNo,
          customerId: data.customerId,
          deliveryStatus: data.deliveryStatus,
          invoiceNo: data.invoiceNo,
          approver: data.approver,
          netValue: rows.reduce((sum, row) => sum + row.netValue, 0),
          items: { create: rows },
          ...licenseFields,
        },
        include: withRelations,
      });
      await createStockOutTx(tx, data.orderNo, data.items);
      return order;
    });
  },

  update: (
    salesOrderId: number,
    data: Partial<{
      orderNo: string;
      customerId: number;
      customerLicenseId: number;
      deliveryStatus: string;
      invoiceNo: string;
      approver: string;
      items: SalesOrderItemInput[];
    }>,
  ) => {
    const { items, customerLicenseId, ...orderFields } = data;

    if (!items) {
      return prisma.$transaction(async (tx) => {
        let licenseFields = {};
        if (customerLicenseId != null) {
          const existing = await tx.salesOrder.findUnique({ where: { salesOrderId }, select: { customerId: true } });
          if (!existing) throw new HttpError(404, "Sales order not found");
          const customerId = data.customerId ?? existing.customerId;
          licenseFields = await validateAndSnapshotLicense(tx, customerId, customerLicenseId);
        }
        return tx.salesOrder.update({ where: { salesOrderId }, data: { ...orderFields, ...licenseFields }, include: withRelations });
      });
    }

    const rows = toItemRows(items);
    return prisma.$transaction(async (tx) => {
      const existing = await tx.salesOrder.findUnique({ where: { salesOrderId }, select: { orderNo: true, customerId: true } });
      if (!existing) throw new HttpError(404, "Sales order not found");

      await reverseAndDeleteByReferenceTx(tx, salesOrderStockReference(existing.orderNo));
      await tx.salesOrderItem.deleteMany({ where: { salesOrderId } });

      let licenseFields = {};
      if (customerLicenseId != null) {
        const customerId = data.customerId ?? existing.customerId;
        licenseFields = await validateAndSnapshotLicense(tx, customerId, customerLicenseId);
      }

      const updated = await tx.salesOrder.update({
        where: { salesOrderId },
        data: {
          ...orderFields,
          ...licenseFields,
          netValue: rows.reduce((sum, row) => sum + row.netValue, 0),
          items: { create: rows },
        },
        include: withRelations,
      });

      const orderNo = data.orderNo ?? existing.orderNo;
      await createStockOutTx(tx, orderNo, items);
      return updated;
    });
  },

  delete: (salesOrderId: number) =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.salesOrder.findUnique({ where: { salesOrderId }, select: { orderNo: true } });
      if (!existing) throw new HttpError(404, "Sales order not found");

      await reverseAndDeleteByReferenceTx(tx, salesOrderStockReference(existing.orderNo));
      return tx.salesOrder.delete({ where: { salesOrderId } });
    }),
};
