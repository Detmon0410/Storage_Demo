import { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";

export const stockDelta = (type: TransactionType, quantity: number) => (type === "OUT" ? -quantity : quantity);

export interface StockTransactionInput {
  transactionNo: string;
  productId: number;
  transactionType: TransactionType;
  quantity: number;
  transactionDate?: Date;
  referenceNo?: string;
  note?: string;
}

export async function createStockTransactionTx(tx: Prisma.TransactionClient, data: StockTransactionInput) {
  if (data.transactionType === "OUT") {
    const product = await tx.product.findUnique({
      where: { productId: data.productId },
      select: { stockQty: true, productName: true },
    });
    if (!product) throw new HttpError(404, `Product ${data.productId} not found`);
    if (product.stockQty < data.quantity) {
      throw new HttpError(
        400,
        `Insufficient stock for ${product.productName}: requested ${data.quantity}, available ${product.stockQty}`,
      );
    }
  }

  const transaction = await tx.stockTransaction.create({ data });
  await tx.product.update({
    where: { productId: data.productId },
    data: { stockQty: { increment: stockDelta(data.transactionType, data.quantity) } },
  });
  return transaction;
}

export async function reverseAndDeleteByReferenceTx(tx: Prisma.TransactionClient, referenceNo: string) {
  const existing = await tx.stockTransaction.findMany({ where: { referenceNo } });
  for (const transaction of existing) {
    await tx.product.update({
      where: { productId: transaction.productId },
      data: { stockQty: { increment: -stockDelta(transaction.transactionType, transaction.quantity) } },
    });
  }
  await tx.stockTransaction.deleteMany({ where: { referenceNo } });
}

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

  create: (data: StockTransactionInput) => prisma.$transaction((tx) => createStockTransactionTx(tx, data)),

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
