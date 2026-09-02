import { Router } from "express";
import {
  createImportOrder,
  deleteImportOrder,
  getImportOrder,
  listImportOrders,
  updateImportOrder,
} from "../controllers/importOrder.controller.js";

export const importOrderRoutes = Router();

importOrderRoutes.get("/", listImportOrders);
importOrderRoutes.get("/:id", getImportOrder);
importOrderRoutes.post("/", createImportOrder);
importOrderRoutes.put("/:id", updateImportOrder);
importOrderRoutes.delete("/:id", deleteImportOrder);
