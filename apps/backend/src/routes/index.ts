import { Router } from "express";
import { categoryRoutes } from "./category.routes.js";
import { productRoutes } from "./product.routes.js";
import { stockTransactionRoutes } from "./stockTransaction.routes.js";
import { supplierRoutes } from "./supplier.routes.js";

export const apiRoutes = Router();

apiRoutes.use("/categories", categoryRoutes);
apiRoutes.use("/suppliers", supplierRoutes);
apiRoutes.use("/products", productRoutes);
apiRoutes.use("/stock-transactions", stockTransactionRoutes);
