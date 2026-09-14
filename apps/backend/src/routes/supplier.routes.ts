import { Router } from "express";
import {
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from "../controllers/supplier.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

export const supplierRoutes = Router();

supplierRoutes.get("/", requireAuth, requirePermission("SUPPLIER_VIEW"), listSuppliers);
supplierRoutes.get("/:id", requireAuth, requirePermission("SUPPLIER_VIEW"), getSupplier);
supplierRoutes.post("/", requireAuth, createSupplier);
supplierRoutes.put("/:id", requireAuth, updateSupplier);
supplierRoutes.delete("/:id", requireAuth, deleteSupplier);
