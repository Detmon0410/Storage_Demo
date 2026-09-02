import { createResourceApi, request } from "./client";
import type {
  Category,
  Customer,
  CustomerLicense,
  DashboardKpi,
  ImportOrder,
  InventoryStock,
  License,
  Product,
  SalesOrder,
  StockTransaction,
  Supplier,
} from "./types";

export const categoryApi = createResourceApi<Category>("/categories");
export const supplierApi = createResourceApi<Supplier>("/suppliers");
export const productApi = createResourceApi<Product>("/products");
export const stockTransactionApi = createResourceApi<StockTransaction>("/stock-transactions");
export const importOrderApi = createResourceApi<ImportOrder>("/import-orders");
export const licenseApi = createResourceApi<License>("/licenses");
export const customerApi = createResourceApi<Customer>("/customers");
export const customerLicenseApi = createResourceApi<CustomerLicense>("/customer-licenses");

export const renewCustomerLicense = (
  customerLicenseId: number,
  body: { licenseNumber: string; issueDate: string; expiryDate: string; documentUrl?: string; notes?: string; actor?: string },
) => request<CustomerLicense>(`/customer-licenses/${customerLicenseId}/renew`, { method: "POST", body: JSON.stringify(body) });
export const salesOrderApi = createResourceApi<SalesOrder>("/sales-orders");
export const inventoryStockApi = createResourceApi<InventoryStock>("/inventory-stocks");
export const dashboardKpiApi = createResourceApi<DashboardKpi>("/dashboard-kpis");
