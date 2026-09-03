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
salesOrderRoutes.post("/", createSalesOrder);
salesOrderRoutes.put("/:id", updateSalesOrder);
salesOrderRoutes.delete("/:id", deleteSalesOrder);
