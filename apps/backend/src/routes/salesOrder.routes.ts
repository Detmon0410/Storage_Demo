import { Router } from "express";
import {
  createSalesOrder,
  deleteSalesOrder,
  getSalesOrder,
  listSalesOrders,
  updateSalesOrder,
} from "../controllers/salesOrder.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const salesOrderRoutes = Router();

salesOrderRoutes.get("/", requireAuth, listSalesOrders);
salesOrderRoutes.get("/:id", requireAuth, getSalesOrder);
salesOrderRoutes.post("/", requireAuth, createSalesOrder);
salesOrderRoutes.put("/:id", requireAuth, updateSalesOrder);
salesOrderRoutes.delete("/:id", requireAuth, deleteSalesOrder);
