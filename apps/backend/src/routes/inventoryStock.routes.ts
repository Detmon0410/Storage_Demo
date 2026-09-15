import { Router } from "express";
import {
  adjustInventoryStock,
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
inventoryStockRoutes.post("/", requireAuth, requirePermission("INVENTORY_CREATE"), createInventoryStock);
inventoryStockRoutes.put("/:id", requireAuth, requirePermission("INVENTORY_EDIT"), updateInventoryStock);
inventoryStockRoutes.post("/:id/adjust", requireAuth, requirePermission("INVENTORY_ADJUST"), adjustInventoryStock);
inventoryStockRoutes.delete("/:id", requireAuth, requirePermission("INVENTORY_DELETE"), deleteInventoryStock);
