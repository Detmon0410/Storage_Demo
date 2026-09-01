import { TransactionType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const stockDelta = (type: TransactionType, quantity: number) => (type === "OUT" ? -quantity : quantity);

export const StockTransactionModel = {
  findAll: () =>
    prisma.stockTransaction.findMany({
      orderBy: { transactionDate: "desc" },
      include: { product: true },
    }),

  findById: (transactionId: number) =>
    prisma.stockTransaction.findUnique({
      where: { transactionId },
      include: { product: true },
    }),

  create: (data: {
    transactionNo: string;
    productId: number;
    transactionType: TransactionType;
    quantity: number;
    transactionDate?: Date;
    referenceNo?: string;
    note?: string;
  }) =>
    prisma.$transaction(async (tx) => {
      const transaction = await tx.stockTransaction.create({ data });
      await tx.product.update({
        where: { productId: data.productId },
        data: { stockQty: { increment: stockDelta(data.transactionType, data.quantity) } },
      });
      return transaction;
    }),

  delete: (transactionId: number) =>
    prisma.$transaction(async (tx) => {
      const transaction = await tx.stockTransaction.delete({ where: { transactionId } });
      await tx.product.update({
        where: { productId: transaction.productId },
        data: { stockQty: { increment: -stockDelta(transaction.transactionType, transaction.quantity) } },
      });
      return transaction;
    }),
};
