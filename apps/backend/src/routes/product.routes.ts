import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "../controllers/product.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const productRoutes = Router();

productRoutes.get("/", requireAuth, listProducts);
productRoutes.get("/:id", requireAuth, getProduct);
productRoutes.post("/", createProduct);
productRoutes.put("/:id", updateProduct);
productRoutes.delete("/:id", deleteProduct);
