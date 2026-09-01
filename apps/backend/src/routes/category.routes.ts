import { Router } from "express";
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "../controllers/category.controller.js";

export const categoryRoutes = Router();

categoryRoutes.get("/", listCategories);
categoryRoutes.get("/:id", getCategory);
categoryRoutes.post("/", createCategory);
categoryRoutes.put("/:id", updateCategory);
categoryRoutes.delete("/:id", deleteCategory);
