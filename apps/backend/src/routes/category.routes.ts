import { Router } from "express";
import {
  createCategory,
  deleteCategory,
  getCategory,
  listCategories,
  updateCategory,
} from "../controllers/category.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

export const categoryRoutes = Router();

categoryRoutes.get("/", requireAuth, requirePermission("CATEGORY_VIEW"), listCategories);
categoryRoutes.get("/:id", requireAuth, requirePermission("CATEGORY_VIEW"), getCategory);
categoryRoutes.post("/", requireAuth, requirePermission("CATEGORY_CREATE"), createCategory);
categoryRoutes.put("/:id", requireAuth, requirePermission("CATEGORY_EDIT"), updateCategory);
categoryRoutes.delete("/:id", requireAuth, requirePermission("CATEGORY_DELETE"), deleteCategory);
