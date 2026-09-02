import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import { createStockTransactionTx, reverseAndDeleteByReferenceTx } from "./stockTransaction.model.js";
import { importOrderStockReference } from "../utils/stockReference.js";

const withRelations = {
  supplier: true,
  items: { include: { product: true } },
} as const;

export interface ImportOrderItemInput {
  productId: number;
  quantity: number;
  unitPrice: number;
}

const toItemRows = (items: ImportOrderItemInput[]) =>
  items.map((item) => ({
    productId: item.productId,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.quantity * item.unitPrice,
  }));

const createStockInTx = async (tx: Prisma.TransactionClient, orderNo: string, items: ImportOrderItemInput[]) => {
  const referenceNo = importOrderStockReference(orderNo);
  for (const [index, item] of items.entries()) {
    await createStockTransactionTx(tx, {
      transactionNo: `${referenceNo}-${index + 1}`,
      productId: item.productId,
      transactionType: "IN",
      quantity: item.quantity,
      referenceNo,
      note: `Auto-generated from import order ${orderNo}`,
    });
  }
};

export const ImportOrderModel = {
  findAll: () =>
    prisma.importOrder.findMany({
      orderBy: { orderDate: "desc" },
      include: withRelations,
    }),

  findById: (importOrderId: number) =>
    prisma.importOrder.findUnique({
      where: { importOrderId },
      include: withRelations,
    }),

  create: (data: {
    orderNo: string;
    supplierId: number;
    country: string;
    incoterms: string;
    orderDate: Date;
    etaDate: Date;
    status: string;
    approver?: string;
    customsEntryNo?: string;
    items: ImportOrderItemInput[];
  }) => {
    const rows = toItemRows(data.items);
    return prisma.$transaction(async (tx) => {
      const order = await tx.importOrder.create({
        data: {
          orderNo: data.orderNo,
          supplierId: data.supplierId,
          country: data.country,
          incoterms: data.incoterms,
          orderDate: data.orderDate,
          etaDate: data.etaDate,
          status: data.status,
          approver: data.approver,
          customsEntryNo: data.customsEntryNo,
          skuItemCount: rows.length,
          totalValue: rows.reduce((sum, row) => sum + row.subtotal, 0),
          items: { create: rows },
        },
        include: withRelations,
      });
      await createStockInTx(tx, data.orderNo, data.items);
      return order;
    });
  },

  update: (
    importOrderId: number,
    data: Partial<{
      orderNo: string;
      supplierId: number;
      country: string;
      incoterms: string;
      orderDate: Date;
      etaDate: Date;
      status: string;
      approver: string;
      customsEntryNo: string;
      items: ImportOrderItemInput[];
    }>,
  ) => {
    const { items, ...orderFields } = data;
    if (!items) {
      return prisma.importOrder.update({ where: { importOrderId }, data: orderFields, include: withRelations });
    }

    const rows = toItemRows(items);
    return prisma.$transaction(async (tx) => {
      const existing = await tx.importOrder.findUnique({ where: { importOrderId }, select: { orderNo: true } });
      if (!existing) throw new HttpError(404, "Import order not found");

      await reverseAndDeleteByReferenceTx(tx, importOrderStockReference(existing.orderNo));
      await tx.importOrderItem.deleteMany({ where: { importOrderId } });

      const updated = await tx.importOrder.update({
        where: { importOrderId },
        data: {
          ...orderFields,
          skuItemCount: rows.length,
          totalValue: rows.reduce((sum, row) => sum + row.subtotal, 0),
          items: { create: rows },
        },
        include: withRelations,
      });

      const orderNo = data.orderNo ?? existing.orderNo;
      await createStockInTx(tx, orderNo, items);
      return updated;
    });
  },

  delete: (importOrderId: number) =>
    prisma.$transaction(async (tx) => {
      const existing = await tx.importOrder.findUnique({ where: { importOrderId }, select: { orderNo: true } });
      if (!existing) throw new HttpError(404, "Import order not found");

      await reverseAndDeleteByReferenceTx(tx, importOrderStockReference(existing.orderNo));
      return tx.importOrder.delete({ where: { importOrderId } });
    }),
};
