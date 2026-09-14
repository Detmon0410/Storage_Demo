import { Router } from "express";
import {
  createStockTransaction,
  deleteStockTransaction,
  getStockTransaction,
  listStockTransactions,
} from "../controllers/stockTransaction.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

export const stockTransactionRoutes = Router();

stockTransactionRoutes.get("/", requireAuth, requirePermission("STOCK_TRANSACTION_VIEW"), listStockTransactions);
stockTransactionRoutes.get("/:id", requireAuth, requirePermission("STOCK_TRANSACTION_VIEW"), getStockTransaction);
stockTransactionRoutes.post("/", requireAuth, createStockTransaction);
stockTransactionRoutes.delete("/:id", requireAuth, deleteStockTransaction);
