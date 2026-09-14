import { Router } from "express";
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "../controllers/customer.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

export const customerRoutes = Router();

customerRoutes.get("/", requireAuth, requirePermission("CUSTOMER_VIEW"), listCustomers);
customerRoutes.get("/:id", requireAuth, requirePermission("CUSTOMER_VIEW"), getCustomer);
customerRoutes.post("/", requireAuth, createCustomer);
customerRoutes.put("/:id", requireAuth, updateCustomer);
customerRoutes.delete("/:id", requireAuth, deleteCustomer);
