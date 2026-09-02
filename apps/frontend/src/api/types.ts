export interface Category {
  categoryId: number;
  categoryCode: string;
  categoryName: string;
  description: string | null;
  isActive: boolean;
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
}

export interface Customer {
  customerId: number;
  customerCode: string;
  customerName: string;
  channelType: string;
  licenseNo: string | null;
  licenseExpiryDate: string | null;
  creditLimit: string;
  currentBalance: string;
  availableCredit: string;
  standardDiscount: string;
  creditStatus: string;
  license?: License | null;
}

export interface SalesOrderItem {
  salesOrderItemId: number;
  salesOrderId: number;
  productId: number;
  quantity: number;
  unitPrice: string;
  discount: string;
  netValue: string;
  lotBatch: string;
  product?: Product;
}

export interface SalesOrder {
  salesOrderId: number;
  orderNo: string;
  customerId: number;
  netValue: string;
  deliveryStatus: string;
  invoiceNo: string;
  approver: string | null;
  customer?: Customer;
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
