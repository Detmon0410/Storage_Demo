import { Router } from "express";
import {
  createStockTransaction,
  deleteStockTransaction,
  getStockTransaction,
  listStockTransactions,
} from "../controllers/stockTransaction.controller.js";

export const stockTransactionRoutes = Router();

stockTransactionRoutes.get("/", listStockTransactions);
stockTransactionRoutes.get("/:id", getStockTransaction);
stockTransactionRoutes.post("/", createStockTransaction);
stockTransactionRoutes.delete("/:id", deleteStockTransaction);
