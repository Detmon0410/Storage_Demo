import { Router } from "express";
import {
  createSalesOrder,
  deleteSalesOrder,
  getSalesOrder,
  listSalesOrders,
  updateSalesOrder,
} from "../controllers/salesOrder.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

export const salesOrderRoutes = Router();

salesOrderRoutes.get("/", requireAuth, requirePermission("SALES_ORDER_VIEW"), listSalesOrders);
salesOrderRoutes.get("/:id", requireAuth, requirePermission("SALES_ORDER_VIEW"), getSalesOrder);
salesOrderRoutes.post("/", requireAuth, createSalesOrder);
salesOrderRoutes.put("/:id", requireAuth, updateSalesOrder);
salesOrderRoutes.delete("/:id", requireAuth, deleteSalesOrder);
