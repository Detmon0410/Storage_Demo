import { Router } from "express";
import {
  createInventoryStock,
  deleteInventoryStock,
  getInventoryStock,
  listInventoryStocks,
  updateInventoryStock,
} from "../controllers/inventoryStock.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

export const inventoryStockRoutes = Router();

inventoryStockRoutes.get("/", requireAuth, requirePermission("INVENTORY_VIEW"), listInventoryStocks);
inventoryStockRoutes.get("/:id", requireAuth, requirePermission("INVENTORY_VIEW"), getInventoryStock);
inventoryStockRoutes.post("/", requireAuth, createInventoryStock);
inventoryStockRoutes.put("/:id", requireAuth, updateInventoryStock);
inventoryStockRoutes.delete("/:id", requireAuth, deleteInventoryStock);
