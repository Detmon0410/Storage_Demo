import { Router } from "express";
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "../controllers/category.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const categoryRoutes = Router();

categoryRoutes.get("/", requireAuth, listCategories);
categoryRoutes.get("/:id", requireAuth, getCategory);
categoryRoutes.post("/", createCategory);
categoryRoutes.put("/:id", updateCategory);
categoryRoutes.delete("/:id", deleteCategory);
