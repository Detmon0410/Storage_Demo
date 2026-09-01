import { Router } from "express";
import {
  createSupplier,
  deleteSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from "../controllers/supplier.controller.js";

export const supplierRoutes = Router();

supplierRoutes.get("/", listSuppliers);
supplierRoutes.get("/:id", getSupplier);
supplierRoutes.post("/", createSupplier);
supplierRoutes.put("/:id", updateSupplier);
supplierRoutes.delete("/:id", deleteSupplier);
