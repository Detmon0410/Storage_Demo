import { Router } from "express";
import {
  createImportOrder,
  deleteImportOrder,
  getImportOrder,
  listImportOrders,
  updateImportOrder,
} from "../controllers/importOrder.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const importOrderRoutes = Router();

importOrderRoutes.get("/", requireAuth, listImportOrders);
importOrderRoutes.get("/:id", requireAuth, getImportOrder);
importOrderRoutes.post("/", requireAuth, createImportOrder);
importOrderRoutes.put("/:id", requireAuth, updateImportOrder);
importOrderRoutes.delete("/:id", deleteImportOrder);
