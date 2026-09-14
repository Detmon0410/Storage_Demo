import { Router } from "express";
import {
  approveImportOrder,
  createImportOrder,
  deleteImportOrder,
  getImportOrder,
  listImportOrders,
  rejectImportOrder,
  updateImportOrder,
} from "../controllers/importOrder.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

export const importOrderRoutes = Router();

importOrderRoutes.get("/", requireAuth, requirePermission("IMPORT_ORDER_VIEW"), listImportOrders);
importOrderRoutes.get("/:id", requireAuth, requirePermission("IMPORT_ORDER_VIEW"), getImportOrder);
importOrderRoutes.post("/", requireAuth, requirePermission("IMPORT_ORDER_CREATE"), createImportOrder);
importOrderRoutes.post("/:id/approve", requireAuth, requirePermission("IMPORT_ORDER_APPROVE"), approveImportOrder);
importOrderRoutes.post("/:id/reject", requireAuth, requirePermission("IMPORT_ORDER_APPROVE"), rejectImportOrder);
importOrderRoutes.put("/:id", requireAuth, requirePermission("IMPORT_ORDER_EDIT"), updateImportOrder);
importOrderRoutes.delete("/:id", requireAuth, requirePermission("IMPORT_ORDER_DELETE"), deleteImportOrder);
