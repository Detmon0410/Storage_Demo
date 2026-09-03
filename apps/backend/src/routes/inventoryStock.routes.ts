import { Router } from "express";
import {
  createInventoryStock,
  deleteInventoryStock,
  getInventoryStock,
  listInventoryStocks,
  updateInventoryStock,
} from "../controllers/inventoryStock.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const inventoryStockRoutes = Router();

inventoryStockRoutes.get("/", requireAuth, listInventoryStocks);
inventoryStockRoutes.get("/:id", requireAuth, getInventoryStock);
inventoryStockRoutes.post("/", createInventoryStock);
inventoryStockRoutes.put("/:id", updateInventoryStock);
inventoryStockRoutes.delete("/:id", deleteInventoryStock);
