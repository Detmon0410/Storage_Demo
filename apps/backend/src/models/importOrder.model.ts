import type { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import { assertProductsNotBlockedTx } from "../utils/licenseGate.js";
import { createStockTransactionTx, reverseAndDeleteByReferenceTx } from "./stockTransaction.model.js";
import { importOrderStockReference } from "../utils/stockReference.js";

type Client = PrismaClient | Prisma.TransactionClient;

const withRelations = {
  supplier: true,
  items: { include: { product: true } },
} as const;

export interface ImportOrderItemInput {
  productId: number;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
}

const toItemRows = (items: ImportOrderItemInput[]) =>
  items.map((item) => {
    const taxRate = item.taxRate ?? 0;
    const subtotal = item.quantity * item.unitPrice;
    const taxAmount = subtotal * (taxRate / 100);
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxRate,
      taxAmount,
      subtotal,
    };
  });

const orderTotals = (rows: ReturnType<typeof toItemRows>) => {
  const taxTotal = rows.reduce((sum, row) => sum + row.taxAmount, 0);
  const totalValue = rows.reduce((sum, row) => sum + row.subtotal, 0) + taxTotal;
  return { taxTotal, totalValue };
};

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

  create: (
    data: {
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
      createdById?: number;
    },
    client: Client = prisma,
  ) => {
    const rows = toItemRows(data.items);
    const run = async (tx: Client) => {
      await assertProductsNotBlockedTx(tx as Prisma.TransactionClient, data.items.map((i) => i.productId));
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
          ...orderTotals(rows),
          items: { create: rows },
          createdById: data.createdById,
        },
        include: withRelations,
      });
      await createStockInTx(tx as Prisma.TransactionClient, data.orderNo, data.items);
      return order;
    };
    return "$transaction" in client ? client.$transaction((tx) => run(tx)) : run(client);
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
    client: Client = prisma,
  ) => {
    const { items, ...orderFields } = data;
    if (!items) {
      return client.importOrder.update({ where: { importOrderId }, data: orderFields, include: withRelations });
    }

    const rows = toItemRows(items);
    const run = async (tx: Client) => {
      const existing = await tx.importOrder.findUnique({ where: { importOrderId }, select: { orderNo: true } });
      if (!existing) throw new HttpError(404, "Import order not found");

      await assertProductsNotBlockedTx(tx as Prisma.TransactionClient, items.map((i) => i.productId));
      await reverseAndDeleteByReferenceTx(tx as Prisma.TransactionClient, importOrderStockReference(existing.orderNo));
      await tx.importOrderItem.deleteMany({ where: { importOrderId } });

      const updated = await tx.importOrder.update({
        where: { importOrderId },
        data: {
          ...orderFields,
          skuItemCount: rows.length,
          ...orderTotals(rows),
          items: { create: rows },
        },
        include: withRelations,
      });

      const orderNo = data.orderNo ?? existing.orderNo;
      await createStockInTx(tx as Prisma.TransactionClient, orderNo, items);
      return updated;
    };
    return "$transaction" in client ? client.$transaction((tx) => run(tx)) : run(client);
  },

  delete: (importOrderId: number, client: Client = prisma) => {
    const run = async (tx: Client) => {
      const existing = await tx.importOrder.findUnique({ where: { importOrderId }, select: { orderNo: true } });
      if (!existing) throw new HttpError(404, "Import order not found");

      await reverseAndDeleteByReferenceTx(tx as Prisma.TransactionClient, importOrderStockReference(existing.orderNo));
      return tx.importOrder.delete({ where: { importOrderId } });
    };
    return "$transaction" in client ? client.$transaction((tx) => run(tx)) : run(client);
  },
};
