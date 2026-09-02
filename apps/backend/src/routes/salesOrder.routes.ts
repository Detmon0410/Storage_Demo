import { Router } from "express";
import {
  createSalesOrder,
  deleteSalesOrder,
  getSalesOrder,
  listSalesOrders,
  updateSalesOrder,
} from "../controllers/salesOrder.controller.js";

export const salesOrderRoutes = Router();

salesOrderRoutes.get("/", listSalesOrders);
salesOrderRoutes.get("/:id", getSalesOrder);
salesOrderRoutes.post("/", createSalesOrder);
salesOrderRoutes.put("/:id", updateSalesOrder);
salesOrderRoutes.delete("/:id", deleteSalesOrder);
