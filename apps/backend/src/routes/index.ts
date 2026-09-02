import { Router } from "express";
import { categoryRoutes } from "./category.routes.js";
import { customerRoutes } from "./customer.routes.js";
import { customerLicenseRoutes } from "./customerLicense.routes.js";
import { dashboardKpiRoutes } from "./dashboardKpi.routes.js";
import { importOrderRoutes } from "./importOrder.routes.js";
import { inventoryStockRoutes } from "./inventoryStock.routes.js";
import { licenseRoutes } from "./license.routes.js";
import { productRoutes } from "./product.routes.js";
import { salesOrderRoutes } from "./salesOrder.routes.js";
import { stockTransactionRoutes } from "./stockTransaction.routes.js";
import { supplierRoutes } from "./supplier.routes.js";

export const apiRoutes = Router();

apiRoutes.use("/categories", categoryRoutes);
apiRoutes.use("/suppliers", supplierRoutes);
apiRoutes.use("/products", productRoutes);
apiRoutes.use("/stock-transactions", stockTransactionRoutes);
apiRoutes.use("/import-orders", importOrderRoutes);
apiRoutes.use("/licenses", licenseRoutes);
apiRoutes.use("/customers", customerRoutes);
apiRoutes.use("/customer-licenses", customerLicenseRoutes);
apiRoutes.use("/sales-orders", salesOrderRoutes);
apiRoutes.use("/inventory-stocks", inventoryStockRoutes);
apiRoutes.use("/dashboard-kpis", dashboardKpiRoutes);
