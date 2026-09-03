import { Router } from "express";
import {
  createCustomer,
  deleteCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
} from "../controllers/customer.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const customerRoutes = Router();

customerRoutes.get("/", requireAuth, listCustomers);
customerRoutes.get("/:id", requireAuth, getCustomer);
customerRoutes.post("/", requireAuth, createCustomer);
customerRoutes.put("/:id", requireAuth, updateCustomer);
customerRoutes.delete("/:id", deleteCustomer);
