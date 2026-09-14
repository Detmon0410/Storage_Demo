import { Router } from "express";
import {
  createImportOrder,
  deleteImportOrder,
  getImportOrder,
  listImportOrders,
  updateImportOrder,
} from "../controllers/importOrder.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

export const importOrderRoutes = Router();

importOrderRoutes.get("/", requireAuth, requirePermission("IMPORT_ORDER_VIEW"), listImportOrders);
importOrderRoutes.get("/:id", requireAuth, requirePermission("IMPORT_ORDER_VIEW"), getImportOrder);
importOrderRoutes.post("/", requireAuth, createImportOrder);
importOrderRoutes.put("/:id", requireAuth, updateImportOrder);
importOrderRoutes.delete("/:id", requireAuth, deleteImportOrder);
