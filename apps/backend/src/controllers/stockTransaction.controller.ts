import { TransactionType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { AuditLogModel } from "../lib/audit.js";
import { StockTransactionModel } from "../models/stockTransaction.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

export const listStockTransactions = asyncHandler(async (_req, res) => {
  res.json(await StockTransactionModel.findAll());
});

export const getStockTransaction = asyncHandler(async (req, res) => {
  const transaction = await StockTransactionModel.findById(Number(req.params.id));
  if (!transaction) throw new HttpError(404, "Stock transaction not found");
  res.json(transaction);
});

export const createStockTransaction = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { transactionNo, productId, transactionType, quantity, transactionDate, referenceNo, note } = req.body;
  if (!transactionNo || !productId || !transactionType || !quantity) {
    throw new HttpError(400, "transactionNo, productId, transactionType, and quantity are required");
  }
  if (!Object.values(TransactionType).includes(transactionType)) {
    throw new HttpError(400, `transactionType must be one of ${Object.values(TransactionType).join(", ")}`);
  }
  const transaction = await prisma.$transaction(async (tx) => {
    const created = await StockTransactionModel.create(
      {
        transactionNo,
        productId: Number(productId),
        transactionType,
        quantity: Number(quantity),
        transactionDate: transactionDate ? new Date(transactionDate) : undefined,
        referenceNo,
        note,
      },
      tx,
    );
    await AuditLogModel.record(tx, {
      entity: "StockTransaction",
      entityId: created.transactionId,
      action: "create",
      userId: req.userId ?? null,
      before: null,
      after: created,
    });
    return created;
  });
  res.status(201).json(transaction);
});

export const deleteStockTransaction = asyncHandler(async (req: AuthenticatedRequest, res) => {
  await prisma.$transaction(async (tx) => {
    const before = await tx.stockTransaction.findUnique({ where: { transactionId: Number(req.params.id) } });
    if (!before) throw new HttpError(404, "Stock transaction not found");
    await StockTransactionModel.delete(Number(req.params.id), tx);
    await AuditLogModel.record(tx, {
      entity: "StockTransaction",
      entityId: before.transactionId,
      action: "delete",
      userId: req.userId ?? null,
      before,
      after: null,
    });
  });
  res.status(204).end();
});
