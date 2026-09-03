import { Router } from "express";
import {
  createStockTransaction,
  deleteStockTransaction,
  getStockTransaction,
  listStockTransactions,
} from "../controllers/stockTransaction.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const stockTransactionRoutes = Router();

stockTransactionRoutes.get("/", requireAuth, listStockTransactions);
stockTransactionRoutes.get("/:id", requireAuth, getStockTransaction);
stockTransactionRoutes.post("/", requireAuth, createStockTransaction);
stockTransactionRoutes.delete("/:id", deleteStockTransaction);
