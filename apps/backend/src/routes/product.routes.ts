import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "../controllers/product.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

export const productRoutes = Router();

productRoutes.get("/", requireAuth, requirePermission("PRODUCT_VIEW"), listProducts);
productRoutes.get("/:id", requireAuth, requirePermission("PRODUCT_VIEW"), getProduct);
productRoutes.post("/", requireAuth, requirePermission("PRODUCT_CREATE"), createProduct);
productRoutes.put("/:id", requireAuth, requirePermission("PRODUCT_EDIT"), updateProduct);
productRoutes.delete("/:id", requireAuth, requirePermission("PRODUCT_DELETE"), deleteProduct);
