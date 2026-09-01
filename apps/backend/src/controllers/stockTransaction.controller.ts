import { TransactionType } from "@prisma/client";
import { StockTransactionModel } from "../models/stockTransaction.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listStockTransactions = asyncHandler(async (_req, res) => {
  res.json(await StockTransactionModel.findAll());
});

export const getStockTransaction = asyncHandler(async (req, res) => {
  const transaction = await StockTransactionModel.findById(Number(req.params.id));
  if (!transaction) throw new HttpError(404, "Stock transaction not found");
  res.json(transaction);
});

export const createStockTransaction = asyncHandler(async (req, res) => {
  const { transactionNo, productId, transactionType, quantity, transactionDate, referenceNo, note } = req.body;
  if (!transactionNo || !productId || !transactionType || !quantity) {
    throw new HttpError(400, "transactionNo, productId, transactionType, and quantity are required");
  }
  if (!Object.values(TransactionType).includes(transactionType)) {
    throw new HttpError(400, `transactionType must be one of ${Object.values(TransactionType).join(", ")}`);
  }
  res.status(201).json(
    await StockTransactionModel.create({
      transactionNo,
      productId: Number(productId),
      transactionType,
      quantity: Number(quantity),
      transactionDate: transactionDate ? new Date(transactionDate) : undefined,
      referenceNo,
      note,
    }),
  );
});

export const deleteStockTransaction = asyncHandler(async (req, res) => {
  await StockTransactionModel.delete(Number(req.params.id));
  res.status(204).end();
});
