import { createResourceApi, request } from "./client";
import type {
  AuditLogFilter,
  AuditLogPage,
  Category,
  Company,
  Customer,
  CustomerLicense,
  DashboardKpi,
  ImportOrder,
  InventoryStock,
  License,
  Product,
  RoleCode,
  SalesOrder,
  StockTransaction,
  Supplier,
  User,
} from "./types";

export const companyApi = {
  get: () => request<Company | null>("/companies"),
  save: (body: { legalName: string; taxId: string; address: string }) =>
    request<Company>("/companies", { method: "PUT", body: JSON.stringify(body) }),
};

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

export const userApi = {
  list: () => request<User[]>("/users"),
  get: (id: number) => request<User>(`/users/${id}`),
  create: (body: { username: string; password: string; status: string; roleCodes: RoleCode[] }) =>
    request<User>("/users", { method: "POST", body: JSON.stringify(body) }),
  update: (id: number, body: { username: string; status: string }) =>
    request<User>(`/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deactivate: (id: number) => request<User>(`/users/${id}/deactivate`, { method: "POST" }),
  reactivate: (id: number) => request<User>(`/users/${id}/reactivate`, { method: "POST" }),
  assignRoles: (id: number, roleCodes: RoleCode[]) =>
    request<User>(`/users/${id}/roles`, { method: "PUT", body: JSON.stringify({ roleCodes }) }),
};

export const auditLogApi = {
  list: (filter: AuditLogFilter = {}) => {
    const params = new URLSearchParams();
    if (filter.entity) params.set("entity", filter.entity);
    if (filter.userId != null) params.set("userId", String(filter.userId));
    if (filter.action) params.set("action", filter.action);
    if (filter.from) params.set("from", filter.from);
    if (filter.to) params.set("to", filter.to);
    if (filter.limit != null) params.set("limit", String(filter.limit));
    if (filter.offset != null) params.set("offset", String(filter.offset));
    const qs = params.toString();
    return request<AuditLogPage>(`/audit-logs${qs ? `?${qs}` : ""}`);
  },
};
