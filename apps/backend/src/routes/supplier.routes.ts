import { Router } from "express";
import {
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from "../controllers/supplier.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const supplierRoutes = Router();

supplierRoutes.get("/", requireAuth, listSuppliers);
supplierRoutes.get("/:id", requireAuth, getSupplier);
supplierRoutes.post("/", requireAuth, createSupplier);
supplierRoutes.put("/:id", requireAuth, updateSupplier);
supplierRoutes.delete("/:id", deleteSupplier);
