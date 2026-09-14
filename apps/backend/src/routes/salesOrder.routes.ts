import { Router } from "express";
import {
  approveSalesOrder,
  createSalesOrder,
  deleteSalesOrder,
  getSalesOrder,
  listSalesOrders,
  rejectSalesOrder,
  updateSalesOrder,
} from "../controllers/salesOrder.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

export const salesOrderRoutes = Router();

salesOrderRoutes.get("/", requireAuth, requirePermission("SALES_ORDER_VIEW"), listSalesOrders);
salesOrderRoutes.get("/:id", requireAuth, requirePermission("SALES_ORDER_VIEW"), getSalesOrder);
salesOrderRoutes.post("/", requireAuth, requirePermission("SALES_ORDER_CREATE"), createSalesOrder);
salesOrderRoutes.post("/:id/approve", requireAuth, requirePermission("SALES_ORDER_APPROVE"), approveSalesOrder);
salesOrderRoutes.post("/:id/reject", requireAuth, requirePermission("SALES_ORDER_APPROVE"), rejectSalesOrder);
salesOrderRoutes.put("/:id", requireAuth, requirePermission("SALES_ORDER_EDIT"), updateSalesOrder);
salesOrderRoutes.delete("/:id", requireAuth, requirePermission("SALES_ORDER_DELETE"), deleteSalesOrder);
