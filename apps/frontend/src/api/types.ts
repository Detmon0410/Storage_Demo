export interface Category {
  categoryId: number;
  categoryCode: string;
  categoryName: string;
  description: string | null;
  isActive: boolean;
}

export interface Company {
  companyId: number;
  legalName: string;
  taxId: string;
  address: string;
}

export interface Supplier {
  supplierId: number;
  supplierCode: string;
  supplierName: string;
  country: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  status: string;
}

export interface Product {
  productId: number;
  productCode: string;
  productName: string;
  categoryId: number;
  supplierId: number;
  unit: string;
  stockQty: number;
  minStock: number;
  unitPrice: string;
  costPrice: string | null;
  suggestedPrice: string | null;
  abvPercent: string | null;
  packageSizeMl: number | null;
  currency: string;
  status: string;
  description: string | null;
  category?: Category;
  supplier?: Supplier;
}

export type TransactionType = "IN" | "OUT" | "ADJUSTMENT";

export interface StockTransaction {
  transactionId: number;
  transactionNo: string;
  productId: number;
  transactionType: TransactionType;
  quantity: number;
  transactionDate: string;
  referenceNo: string | null;
  note: string | null;
  product?: Product;
}

export interface ImportOrderItem {
  importOrderItemId: number;
  importOrderId: number;
  productId: number;
  quantity: number;
  unitPrice: string;
  taxRate: string;
  taxAmount: string;
  subtotal: string;
  product?: Product;
  importOrder?: ImportOrder;
}

export interface ImportOrder {
  importOrderId: number;
  orderNo: string;
  supplierId: number;
  country: string;
  incoterms: string;
  orderDate: string;
  etaDate: string;
  skuItemCount: number;
  totalValue: string;
  taxTotal: string;
  status: string;
  approver: string | null;
  customsEntryNo: string | null;
  supplier?: Supplier;
  items?: ImportOrderItem[];
}

export interface License {
  licenseId: number;
  licenseNo: string;
  licenseType: string;
  holderName: string;
  category: string;
  issueDate: string;
  expiryDate: string;
  daysRemaining: number;
  status: string;
  companyId: number | null;
  productId: number | null;
  company?: Company;
  product?: Product;
}

export interface Customer {
  customerId: number;
  customerCode: string;
  customerName: string;
  channelType: string;
  creditLimit: string;
  currentBalance: string;
  availableCredit: string;
  standardDiscount: string;
  creditStatus: string;
  licenses?: CustomerLicense[];
}

export type CustomerLicenseStatus = "ACTIVE" | "EXPIRED" | "REVOKED" | "SUSPENDED" | "PENDING";

export interface CustomerLicense {
  customerLicenseId: number;
  customerId: number;
  licenseNumber: string;
  licenseType: string;
  applicableChannel: string | null;
  issueDate: string;
  expiryDate: string;
  status: CustomerLicenseStatus;
  documentUrl: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
  statusChangedBy: string | null;
  statusChangedAt: string | null;
  renewedFromId: number | null;
  customer?: Customer;
}

export interface SalesOrderItem {
  salesOrderItemId: number;
  salesOrderId: number;
  productId: number;
  quantity: number;
  unitPrice: string;
  discount: string;
  taxRate: string;
  taxAmount: string;
  netValue: string;
  lotBatch: string;
  product?: Product;
}

export interface SalesOrder {
  salesOrderId: number;
  orderNo: string;
  customerId: number;
  netValue: string;
  taxTotal: string;
  deliveryStatus: string;
  invoiceNo: string;
  approver: string | null;
  customerLicenseId: number | null;
  licenseNumberSnapshot: string | null;
  licenseTypeSnapshot: string | null;
  licenseExpirySnapshot: string | null;
  customer?: Customer;
  customerLicense?: CustomerLicense | null;
  items?: SalesOrderItem[];
}

export interface InventoryStock {
  inventoryStockId: number;
  productId: number;
  importOrderItemId: number | null;
  lotBatch: string;
  receivedDate: string;
  quantityOnHand: number;
  stockAgeDays: number;
  stockStatus: string;
  warehouse: string;
  product?: Product;
  importOrderItem?: ImportOrderItem | null;
}

export interface DashboardKpi {
  dashboardKpiId: number;
  metricName: string;
  currentValue: string;
  unit: string;
  monthTrend: string;
}

export type RoleCode =
  | "SYSTEM_ADMIN"
  | "MANAGER_APPROVER"
  | "IMPORT_COMPLIANCE_OFFICER"
  | "WAREHOUSE_DISTRIBUTION_OFFICER"
  | "SALES_OFFICER"
  | "FINANCE_ACCOUNTING_OFFICER";

export interface User {
  id: number;
  username: string;
  status: "ACTIVE" | "INACTIVE";
  roles: RoleCode[];
}

export interface AuditLog {
  auditLogId: number;
  entity: string;
  entityId: string;
  action: string;
  userId: number | null;
  before: unknown;
  after: unknown;
  createdAt: string;
  user?: { id: number; username: string } | null;
}

export interface AuditLogFilter {
  entity?: string;
  userId?: number;
  action?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface AuditLogPage {
  items: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}
