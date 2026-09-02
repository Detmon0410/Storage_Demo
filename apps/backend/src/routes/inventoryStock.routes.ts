import { Router } from "express";
import {
  createInventoryStock,
  deleteInventoryStock,
  getInventoryStock,
  listInventoryStocks,
  updateInventoryStock,
} from "../controllers/inventoryStock.controller.js";

export const inventoryStockRoutes = Router();

inventoryStockRoutes.get("/", listInventoryStocks);
inventoryStockRoutes.get("/:id", getInventoryStock);
inventoryStockRoutes.post("/", createInventoryStock);
inventoryStockRoutes.put("/:id", updateInventoryStock);
inventoryStockRoutes.delete("/:id", deleteInventoryStock);
