import { Router } from "express";
import {
  createProduct,
  deleteProduct,
  getProduct,
  listProducts,
  updateProduct,
} from "../controllers/product.controller.js";

export const productRoutes = Router();

productRoutes.get("/", listProducts);
productRoutes.get("/:id", getProduct);
productRoutes.post("/", createProduct);
productRoutes.put("/:id", updateProduct);
productRoutes.delete("/:id", deleteProduct);
