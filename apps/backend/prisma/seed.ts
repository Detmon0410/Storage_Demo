import * as argon2 from "@node-rs/argon2";
import { CustomerLicenseStatus, PrismaClient, TransactionType } from "@prisma/client";
import { CustomerLicenseModel } from "../src/models/customerLicense.model.js";
import { ImportOrderModel } from "../src/models/importOrder.model.js";
import { SalesOrderModel } from "../src/models/salesOrder.model.js";
import { StockTransactionModel } from "../src/models/stockTransaction.model.js";

const prisma = new PrismaClient();

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const nullable = (value: string) => (value === "-" ? null : value);

// Demo dataset for a liquor importer/wholesaler warehoused in Japan: goods are imported
// from overseas suppliers, cleared through Japanese customs, and distributed to Japanese
// retailers, restaurants/bars, and online channels. Status-like fields use locale-neutral
// codes (e.g. "READY", "STAGING") — the frontend i18n layer renders them in English/Japanese.
const categories = [
  { categoryCode: "CAT-WHISKY", categoryName: "Whisky", description: "Whisky and malt spirits", isActive: true },
  { categoryCode: "CAT-TEQUILA", categoryName: "Tequila", description: "Tequila products", isActive: true },
  { categoryCode: "CAT-RED-WINE", categoryName: "Red Wine", description: "Red wine products", isActive: true },
  { categoryCode: "CAT-WHITE-WINE", categoryName: "White Wine", description: "White wine products", isActive: true },
  { categoryCode: "CAT-VODKA", categoryName: "Vodka", description: "Vodka products", isActive: true },
  { categoryCode: "CAT-GIN", categoryName: "Gin", description: "Gin products", isActive: true },
  { categoryCode: "CAT-LIQUEUR", categoryName: "Liqueur", description: "Liqueur products", isActive: true },
  { categoryCode: "CAT-RUM", categoryName: "Rum", description: "Rum products", isActive: true },
  { categoryCode: "CAT-BEER", categoryName: "Beer", description: "Beer products", isActive: true },
];

// All overseas suppliers — genuinely imported into the Japan warehouse (each origin is
// foreign relative to Japan, so every shipment legitimately clears customs).
const suppliers = [
  { supplierCode: "SUP-HIGHLAND", supplierName: "Highland Spirits Co., Ltd.", country: "Scotland", status: "ACTIVE" },
  { supplierCode: "SUP-CASA-ROBLE", supplierName: "Casa Roble Distillery", country: "Mexico", status: "ACTIVE" },
  { supplierCode: "SUP-BELMONT", supplierName: "Chateau Belmont Vineyards", country: "France", status: "ACTIVE" },
  { supplierCode: "SUP-NORDIC", supplierName: "Nordic Frost Distillers", country: "Sweden", status: "ACTIVE" },
  { supplierCode: "SUP-BLUE-CORAL", supplierName: "Blue Coral Distillers", country: "England", status: "ACTIVE" },
  { supplierCode: "SUP-AMBER", supplierName: "Amber Harbor Rum Co.", country: "Jamaica", status: "ACTIVE" },
  { supplierCode: "SUP-GOLDEN-PLUM", supplierName: "Golden Blossom Distillery", country: "Taiwan", status: "ACTIVE" },
  { supplierCode: "SUP-RIVERSIDE", supplierName: "Riverside Craft Brewery", country: "United States", status: "ACTIVE" },
];

// Prices are in JPY, sized for a Japanese wholesale/retail market.
const products = [
  ["SKU-1001", "Golden Barrel Single Malt 12Y", "CAT-WHISKY", "SUP-HIGHLAND", 43, 700, "bottle", 7400, 9800, 420, "READY"],
  ["SKU-1002", "Golden Barrel Single Malt 18Y", "CAT-WHISKY", "SUP-HIGHLAND", 43, 700, "bottle", 17000, 23000, 96, "READY"],
  ["SKU-1003", "Highland Mist Blended", "CAT-WHISKY", "SUP-HIGHLAND", 40, 750, "bottle", 3100, 4300, 1250, "READY"],
  ["SKU-1004", "Casa Roble Reposado", "CAT-TEQUILA", "SUP-CASA-ROBLE", 38, 750, "bottle", 3900, 5400, 300, "READY"],
  ["SKU-1005", "Chateau Belmont Rouge 2019", "CAT-RED-WINE", "SUP-BELMONT", 13.5, 750, "bottle", 2600, 3700, 640, "READY"],
  ["SKU-1006", "Chateau Belmont Blanc 2021", "CAT-WHITE-WINE", "SUP-BELMONT", 12.5, 750, "bottle", 2500, 3500, 18, "LOW_STOCK"],
  ["SKU-1007", "Nordic Frost Vodka", "CAT-VODKA", "SUP-NORDIC", 40, 700, "bottle", 2100, 3100, 980, "READY"],
  ["SKU-1008", "Blue Coral Gin", "CAT-GIN", "SUP-BLUE-CORAL", 42, 700, "bottle", 2400, 3500, 0, "OUT_OF_STOCK"],
  ["SKU-1009", "Golden Blossom Plum Liqueur", "CAT-LIQUEUR", "SUP-GOLDEN-PLUM", 15, 500, "bottle", 1500, 2300, 210, "READY"],
  ["SKU-1010", "Amber Harbor Rum Dark", "CAT-RUM", "SUP-AMBER", 40, 700, "bottle", 2200, 3200, 75, "READY"],
  ["SKU-1011", "Golden Barrel Cask Reserve", "CAT-WHISKY", "SUP-HIGHLAND", 46, 700, "bottle", 12500, 17200, 12, "LOW_STOCK"],
  ["SKU-1012", "Riverside Craft Lager 6-pack", "CAT-BEER", "SUP-RIVERSIDE", 5, 330, "pack", 820, 1250, 560, "READY"],
] as const;

// Import orders can carry several liquor varieties from the same supplier in one shipment
// (see e.g. IMP-2026-0142 and IMP-2026-0150/0151, all Highland Spirits, at different stages
// of the pipeline). Each line item is what inventory lots later reference for traceability.
// Approvers are the two warehouse managers who sign off on receipts and exceptions.
const importOrders = [
  {
    orderNo: "IMP-2026-0139",
    supplierCode: "SUP-GOLDEN-PLUM",
    country: "Taiwan",
    incoterms: "CIF",
    orderDate: "2026-07-01",
    etaDate: "2026-07-20",
    status: "RECEIVED",
    approver: "Kumiko Sato (Manager)",
    customsEntryNo: "IDN-2026-004488",
    items: [{ productCode: "SKU-1009", quantity: 300, unitPrice: 1500 }],
  },
  {
    orderNo: "IMP-2026-0142",
    supplierCode: "SUP-HIGHLAND",
    country: "Scotland",
    incoterms: "CIF",
    orderDate: "2026-07-02",
    etaDate: "2026-08-10",
    status: "STAGING",
    approver: "-",
    customsEntryNo: "-",
    items: [
      { productCode: "SKU-1001", quantity: 120, unitPrice: 7400 },
      { productCode: "SKU-1002", quantity: 30, unitPrice: 17000 },
      { productCode: "SKU-1003", quantity: 200, unitPrice: 3100 },
    ],
  },
  {
    orderNo: "IMP-2026-0143",
    supplierCode: "SUP-CASA-ROBLE",
    country: "Mexico",
    incoterms: "FOB",
    orderDate: "2026-07-05",
    etaDate: "2026-08-15",
    status: "PENDING_APPROVAL",
    approver: "-",
    customsEntryNo: "-",
    items: [{ productCode: "SKU-1004", quantity: 400, unitPrice: 3900 }],
  },
  {
    orderNo: "IMP-2026-0144",
    supplierCode: "SUP-BELMONT",
    country: "France",
    incoterms: "CIF",
    orderDate: "2026-03-25",
    etaDate: "2026-04-28",
    status: "RECEIVED",
    approver: "Makoto Tanaka (Manager)",
    customsEntryNo: "IDN-2026-002215",
    items: [
      { productCode: "SKU-1005", quantity: 700, unitPrice: 2600 },
      { productCode: "SKU-1006", quantity: 650, unitPrice: 2500 },
    ],
  },
  {
    orderNo: "IMP-2026-0145",
    supplierCode: "SUP-NORDIC",
    country: "Sweden",
    incoterms: "FOB",
    orderDate: "2026-04-10",
    etaDate: "2026-05-20",
    status: "RECEIVED",
    approver: "Makoto Tanaka (Manager)",
    customsEntryNo: "IDN-2026-001987",
    items: [{ productCode: "SKU-1007", quantity: 1200, unitPrice: 2100 }],
  },
  {
    orderNo: "IMP-2026-0146",
    supplierCode: "SUP-BLUE-CORAL",
    country: "England",
    incoterms: "CIF",
    orderDate: "2026-06-10",
    etaDate: "2026-07-15",
    status: "RECEIVED",
    approver: "Kumiko Sato (Manager)",
    customsEntryNo: "IDN-2026-002602",
    items: [{ productCode: "SKU-1008", quantity: 400, unitPrice: 2400 }],
  },
  {
    orderNo: "IMP-2026-0147",
    supplierCode: "SUP-AMBER",
    country: "Jamaica",
    incoterms: "FOB",
    orderDate: "2026-06-01",
    etaDate: "2026-07-05",
    status: "RECEIVED",
    approver: "Kumiko Sato (Manager)",
    customsEntryNo: "IDN-2026-002478",
    items: [{ productCode: "SKU-1010", quantity: 120, unitPrice: 2200 }],
  },
  {
    orderNo: "IMP-2026-0148",
    supplierCode: "SUP-HIGHLAND",
    country: "Scotland",
    incoterms: "CIF",
    orderDate: "2026-01-05",
    etaDate: "2026-01-10",
    status: "RECEIVED",
    approver: "Makoto Tanaka (Manager)",
    customsEntryNo: "IDN-2026-000112",
    items: [{ productCode: "SKU-1011", quantity: 60, unitPrice: 12500 }],
  },
  {
    orderNo: "IMP-2026-0149",
    supplierCode: "SUP-GOLDEN-PLUM",
    country: "Taiwan",
    incoterms: "CIF",
    orderDate: "2026-07-15",
    etaDate: "2026-08-25",
    status: "ISSUE",
    approver: "-",
    customsEntryNo: "-",
    items: [{ productCode: "SKU-1009", quantity: 150, unitPrice: 1500 }],
  },
  {
    orderNo: "IMP-2026-0150",
    supplierCode: "SUP-HIGHLAND",
    country: "Scotland",
    incoterms: "CIF",
    orderDate: "2026-04-01",
    etaDate: "2026-05-01",
    status: "RECEIVED",
    approver: "Makoto Tanaka (Manager)",
    customsEntryNo: "IDN-2026-001654",
    items: [
      { productCode: "SKU-1002", quantity: 100, unitPrice: 17000 },
      { productCode: "SKU-1003", quantity: 1300, unitPrice: 3100 },
    ],
  },
  {
    orderNo: "IMP-2026-0151",
    supplierCode: "SUP-HIGHLAND",
    country: "Scotland",
    incoterms: "CIF",
    orderDate: "2026-06-20",
    etaDate: "2026-07-15",
    status: "RECEIVED",
    approver: "Kumiko Sato (Manager)",
    customsEntryNo: "IDN-2026-002389",
    items: [{ productCode: "SKU-1001", quantity: 400, unitPrice: 7400 }],
  },
  {
    orderNo: "IMP-2026-0152",
    supplierCode: "SUP-BELMONT",
    country: "France",
    incoterms: "CIF",
    orderDate: "2026-08-10",
    etaDate: "2026-09-20",
    status: "APPROVED",
    approver: "Makoto Tanaka (Manager)",
    customsEntryNo: "-",
    items: [{ productCode: "SKU-1005", quantity: 400, unitPrice: 2600 }],
  },
  {
    orderNo: "IMP-2026-0153",
    supplierCode: "SUP-NORDIC",
    country: "Sweden",
    incoterms: "FOB",
    orderDate: "2026-07-20",
    etaDate: "2026-08-25",
    status: "CUSTOMS_CLEARED",
    approver: "Kumiko Sato (Manager)",
    customsEntryNo: "IDN-2026-002911",
    items: [{ productCode: "SKU-1007", quantity: 600, unitPrice: 2100 }],
  },
] as const;

// The generic License table is now IMPORT-only — the company's own wholesale licenses.
// Each customer's liquor sales license lives in the dedicated CustomerLicense table below
// (see `customerLicenses`), managed separately from the Customer master record.
const licenses = [
  ["LIC-IMP-0011", "Liquor Wholesale Business License", "Tokyo Liquor Import Co., Ltd.", "IMPORT", "2025-01-10", "2026-01-09", -235, "EXPIRED"],
  ["LIC-IMP-0012", "Liquor Wholesale Business License (Category 2)", "Tokyo Liquor Import Co., Ltd.", "IMPORT", "2025-09-01", "2026-08-31", -2, "EXPIRED"],
  ["LIC-IMP-0013", "Liquor Import Permit - Kingdom Entry", "Tokyo Liquor Import Co., Ltd.", "IMPORT", "2026-04-01", "2027-03-31", 210, "NORMAL"],
  ["LIC-IMP-0014", "Imported Liquor Label Approval Certificate", "Tokyo Liquor Import Co., Ltd.", "IMPORT", "2026-03-15", "2026-09-12", 10, "EXPIRING_SOON"],
  ["LIC-IMP-0015", "Import Completion Evidence Filing", "Tokyo Liquor Import Co., Ltd.", "IMPORT", "2026-06-01", "2028-05-31", 637, "NORMAL"],
  ["LIC-IMP-0016", "Excise Stamp Control Permit", "Tokyo Liquor Import Co., Ltd.", "IMPORT", "2026-08-20", "2026-10-02", 30, "EXPIRING_SOON"],
] as const;

// Credit limits/balances are in JPY, sized for small-to-mid Japanese liquor retailers,
// restaurants/bars, and distributors.
const customers = [
  ["CUS-0001", "Tokyo Shuhan Trading Co., Ltd.", "DISTRIBUTOR", 12000000, 8700000, 3300000, 8, "NORMAL"],
  ["CUS-0002", "Shiawase Supermarket", "RETAIL_WHOLESALE", 3000000, 2880000, 120000, 5, "NEAR_LIMIT"],
  ["CUS-0003", "Sumida River Riverside Bar", "RESTAURANT_BAR", 1800000, 540000, 1260000, 10, "NORMAL"],
  ["CUS-0004", "24-Hour Minimart Nakano", "RETAIL_WHOLESALE", 900000, 240000, 660000, 5, "NORMAL"],
  ["CUS-0005", "Hokkaido Liquor Distribution Co., Ltd.", "DISTRIBUTOR", 10800000, 1920000, 8880000, 8, "NORMAL"],
  ["CUS-0006", "Obaachan's Kitchen Restaurant", "RESTAURANT_BAR", 1500000, 1560000, -60000, 10, "OVER_LIMIT"],
  ["CUS-0007", "DrinkHub Online Store", "ONLINE", 2400000, 330000, 2070000, 6, "NO_LICENSE"],
] as const;

// Each customer's liquor sales license, managed separately from the Customer master record
// (one customer may have multiple licenses over time — see the renewal-chain example for
// CUS-0004 below). applicableChannel restricts a license to the customer's own sales
// channel, demonstrating the Sales Order channel filter. CUS-0007 (DrinkHub) intentionally
// has only a pending license, to demonstrate the "no valid active license, order blocked" flow.
const customerLicenses = [
  {
    licenseNumber: "LIC-SELL-2201",
    customerCode: "CUS-0001",
    licenseType: "Liquor Wholesale Business License",
    applicableChannel: "DISTRIBUTOR",
    issueDate: "2025-03-01",
    expiryDate: "2026-09-20",
    status: CustomerLicenseStatus.ACTIVE,
  },
  {
    licenseNumber: "LIC-SELL-2201-ONLINE",
    customerCode: "CUS-0001",
    licenseType: "Online Liquor Retail Addendum",
    applicableChannel: "ONLINE",
    issueDate: "2026-08-15",
    expiryDate: "2026-10-14",
    status: CustomerLicenseStatus.PENDING,
  },
  {
    licenseNumber: "LIC-SELL-2202",
    customerCode: "CUS-0002",
    licenseType: "Liquor Retail Business License",
    applicableChannel: "RETAIL_WHOLESALE",
    issueDate: "2024-10-15",
    expiryDate: "2026-09-15",
    status: CustomerLicenseStatus.ACTIVE,
  },
  {
    licenseNumber: "LIC-SELL-2202-S1",
    customerCode: "CUS-0002",
    licenseType: "Liquor Retail Business License",
    applicableChannel: "RETAIL_WHOLESALE",
    issueDate: "2025-02-01",
    expiryDate: "2027-01-31",
    status: CustomerLicenseStatus.SUSPENDED,
  },
  {
    licenseNumber: "LIC-SELL-2203",
    customerCode: "CUS-0003",
    licenseType: "Liquor Retail Business License (Restaurant/Bar)",
    applicableChannel: "RESTAURANT_BAR",
    issueDate: "2025-05-01",
    expiryDate: "2026-11-30",
    status: CustomerLicenseStatus.ACTIVE,
  },
  {
    licenseNumber: "LIC-SELL-2203-EVENT",
    customerCode: "CUS-0003",
    licenseType: "Temporary Event Liquor Sales Permit",
    applicableChannel: "RESTAURANT_BAR",
    issueDate: "2026-08-01",
    expiryDate: "2026-08-31",
    status: CustomerLicenseStatus.EXPIRED,
  },
  {
    licenseNumber: "LIC-SELL-2204",
    customerCode: "CUS-0004",
    licenseType: "Liquor Retail Business License",
    applicableChannel: "RETAIL_WHOLESALE",
    issueDate: "2024-08-01",
    expiryDate: "2025-07-31",
    status: CustomerLicenseStatus.EXPIRED,
  },
  {
    licenseNumber: "LIC-SELL-2205",
    customerCode: "CUS-0005",
    licenseType: "Liquor Wholesale Business License",
    applicableChannel: "DISTRIBUTOR",
    issueDate: "2025-06-01",
    expiryDate: "2027-05-31",
    status: CustomerLicenseStatus.ACTIVE,
  },
  {
    licenseNumber: "LIC-SELL-2205-OLD",
    customerCode: "CUS-0005",
    licenseType: "Liquor Wholesale Business License",
    applicableChannel: "DISTRIBUTOR",
    issueDate: "2023-06-01",
    expiryDate: "2025-05-31",
    status: CustomerLicenseStatus.EXPIRED,
  },
  {
    licenseNumber: "LIC-SELL-2206",
    customerCode: "CUS-0006",
    licenseType: "Liquor Retail Business License (Restaurant/Bar)",
    applicableChannel: "RESTAURANT_BAR",
    issueDate: "2025-01-20",
    expiryDate: "2026-09-05",
    status: CustomerLicenseStatus.ACTIVE,
  },
  {
    licenseNumber: "LIC-SELL-2206-RVK",
    customerCode: "CUS-0006",
    licenseType: "Liquor Retail Business License (Restaurant/Bar)",
    applicableChannel: "RESTAURANT_BAR",
    issueDate: "2024-01-20",
    expiryDate: "2026-01-19",
    status: CustomerLicenseStatus.REVOKED,
  },
  {
    licenseNumber: "LIC-SELL-2207-P1",
    customerCode: "CUS-0007",
    licenseType: "Online Liquor Retail License",
    applicableChannel: "ONLINE",
    issueDate: "2026-08-25",
    expiryDate: "2027-08-24",
    status: CustomerLicenseStatus.PENDING,
  },
] as const;

// A sales order can ship several products to one customer in a single order/invoice
// (see e.g. SO-2026-3301 and SO-2026-3309, each carrying multiple SKUs). Every line item
// keeps its own lot/batch reference so each product on the invoice is traceable back to
// the exact stock lot it was picked from.
const salesOrders = [
  {
    orderNo: "SO-2026-3301",
    customerCode: "CUS-0001",
    deliveryStatus: "DELIVERED",
    invoiceNo: "INV-2026-8801",
    approver: "-",
    items: [
      { productCode: "SKU-1001", quantity: 40, unitPrice: 9800, discount: 5, lotBatch: "LOT-A2607-01" },
      { productCode: "SKU-1007", quantity: 20, unitPrice: 3100, discount: 5, lotBatch: "LOT-A2606-01" },
    ],
  },
  {
    orderNo: "SO-2026-3302",
    customerCode: "CUS-0002",
    deliveryStatus: "DELIVERED",
    invoiceNo: "INV-2026-8802",
    approver: "-",
    items: [{ productCode: "SKU-1003", quantity: 120, unitPrice: 4300, discount: 3, lotBatch: "LOT-A2605-02" }],
  },
  {
    orderNo: "SO-2026-3303",
    customerCode: "CUS-0003",
    deliveryStatus: "SHIPPING",
    invoiceNo: "INV-2026-8803",
    approver: "Manager: Makoto Tanaka",
    items: [{ productCode: "SKU-1007", quantity: 30, unitPrice: 3100, discount: 12, lotBatch: "LOT-A2606-01" }],
  },
  {
    orderNo: "SO-2026-3304",
    customerCode: "CUS-0004",
    deliveryStatus: "SHIPPING",
    invoiceNo: "INV-2026-8804",
    approver: "-",
    items: [
      { productCode: "SKU-1009", quantity: 24, unitPrice: 2300, discount: 5, lotBatch: "LOT-A2607-03" },
      { productCode: "SKU-1010", quantity: 10, unitPrice: 3200, discount: 5, lotBatch: "LOT-A2607-02" },
    ],
  },
  {
    orderNo: "SO-2026-3305",
    customerCode: "CUS-0005",
    deliveryStatus: "DELIVERED",
    invoiceNo: "INV-2026-8805",
    approver: "-",
    items: [{ productCode: "SKU-1002", quantity: 12, unitPrice: 23000, discount: 8, lotBatch: "LOT-A2604-01" }],
  },
  {
    orderNo: "SO-2026-3306",
    customerCode: "CUS-0006",
    deliveryStatus: "PENDING",
    invoiceNo: "INV-2026-8806",
    approver: "Manager: Kumiko Sato",
    items: [{ productCode: "SKU-1005", quantity: 48, unitPrice: 3700, discount: 15, lotBatch: "LOT-A2606-02" }],
  },
  {
    orderNo: "SO-2026-3307",
    customerCode: "CUS-0007",
    deliveryStatus: "RETURNED",
    invoiceNo: "INV-2026-8807",
    approver: "-",
    items: [{ productCode: "SKU-1010", quantity: 20, unitPrice: 3200, discount: 6, lotBatch: "LOT-A2607-02" }],
  },
  {
    orderNo: "SO-2026-3308",
    customerCode: "CUS-0002",
    deliveryStatus: "DAMAGED",
    invoiceNo: "INV-2026-8808",
    approver: "-",
    items: [{ productCode: "SKU-1006", quantity: 18, unitPrice: 3500, discount: 5, lotBatch: "LOT-A2605-04" }],
  },
  {
    orderNo: "SO-2026-3309",
    customerCode: "CUS-0005",
    deliveryStatus: "DELIVERED",
    invoiceNo: "INV-2026-8809",
    approver: "-",
    items: [
      { productCode: "SKU-1001", quantity: 50, unitPrice: 9800, discount: 8, lotBatch: "LOT-A2607-01" },
      { productCode: "SKU-1003", quantity: 200, unitPrice: 4300, discount: 8, lotBatch: "LOT-A2605-02" },
      { productCode: "SKU-1011", quantity: 5, unitPrice: 17200, discount: 8, lotBatch: "LOT-A2601-01" },
    ],
  },
] as const;

// Each inventory lot optionally references the import order that brought it in
// (orderNo + productCode resolve to the matching import order item) for traceability.
// A lot with orderNo "-" represents stock entered manually (e.g. an opening balance),
// which is a normal, unlinked case. Warehouses are all Japan-based.
const inventoryStocks = [
  ["SKU-1001", "LOT-A2607-01", "2026-07-20", 360, 43, "NORMAL", "Warehouse A - Tokyo", "IMP-2026-0151"],
  ["SKU-1002", "LOT-A2604-01", "2026-04-18", 84, 136, "AGING_SOON", "Warehouse A - Tokyo", "IMP-2026-0150"],
  ["SKU-1003", "LOT-A2605-02", "2026-05-22", 1130, 102, "AGING_SOON", "Warehouse B - Osaka", "IMP-2026-0150"],
  ["SKU-1005", "LOT-A2606-02", "2026-06-10", 592, 83, "NORMAL", "Warehouse B - Osaka", "IMP-2026-0144"],
  ["SKU-1006", "LOT-A2605-04", "2026-05-05", 18, 119, "AGING_SOON", "Warehouse B - Osaka", "IMP-2026-0144"],
  ["SKU-1007", "LOT-A2606-01", "2026-06-01", 950, 92, "AGING_SOON", "Warehouse A - Tokyo", "IMP-2026-0145"],
  ["SKU-1009", "LOT-A2607-03", "2026-07-25", 186, 38, "NORMAL", "Warehouse A - Tokyo", "IMP-2026-0139"],
  ["SKU-1010", "LOT-A2607-02", "2026-07-18", 55, 45, "NORMAL", "Warehouse C - Yokohama", "IMP-2026-0147"],
  ["SKU-1011", "LOT-A2601-01", "2026-01-15", 12, 229, "AGING", "Warehouse A - Tokyo", "IMP-2026-0148"],
  ["SKU-1012", "LOT-LOCAL-0001", "2026-08-13", 560, 20, "NORMAL", "Warehouse A - Tokyo", "-"],
] as const;

// KPI metricName/unit are locale-neutral codes (see frontend src/lib/kpi.ts for the
// label/unit/direction lookup). monthTrend is a signed delta: an absolute change in the
// metric's own unit for DAYS/PERCENT/ITEMS/TIMES/SKU metrics, or a percent-of-value change
// for JPY metrics (e.g. "+3.4" on TOTAL_STOCK_VALUE means stock value grew 3.4%).
const dashboardKpis = [
  ["AVG_IMPORT_LEAD_TIME", 27, "DAYS", "-3"],
  ["STAGING_ERROR_RATE", 6.2, "PERCENT", "-1.1"],
  ["TOTAL_STOCK_VALUE", 12200000, "JPY", "+3.4"],
  ["LICENSES_EXPIRING_SOON", 3, "ITEMS", "+1"],
  ["MONTHLY_TAX_DUTY_COST", 1150000, "JPY", "+5.8"],
  ["MONTHLY_SALES_TOTAL", 2940000, "JPY", "+9.2"],
  ["INVENTORY_TURNOVER", 1.8, "TIMES", "+0.2"],
  ["AGING_STOCK_COUNT", 2, "SKU", "0"],
  ["ON_TIME_DELIVERY_RATE", 94.5, "PERCENT", "-1.0"],
  ["TOTAL_OUTSTANDING_CREDIT", 16170000, "JPY", "+2.1"],
] as const;

async function main() {
  const adminUsername = "admin";
  const adminPassword = process.env.ADMIN_DEFAULT_PASSWORD ?? "changeme123";
  const existingAdmin = await prisma.user.findUnique({ where: { username: adminUsername } });
  if (!existingAdmin) {
    const passwordHash = await argon2.hash(adminPassword);
    await prisma.user.create({
      data: { username: adminUsername, passwordHash, status: "ACTIVE" },
    });
    if (process.env.ADMIN_DEFAULT_PASSWORD) {
      console.log(`Seeded default System Admin user "${adminUsername}" (password set via ADMIN_DEFAULT_PASSWORD)`);
    } else {
      console.log(`Seeded default System Admin user "${adminUsername}" (password: ${adminPassword} — set ADMIN_DEFAULT_PASSWORD env var in production)`);
    }
  } else {
    console.log(`System Admin user "${adminUsername}" already exists, skipping`);
  }

  await prisma.$transaction([
    prisma.stockTransaction.deleteMany(),
    prisma.salesOrderItem.deleteMany(),
    prisma.salesOrder.deleteMany(),
    // Break the self-referential renewal chain before bulk-deleting, otherwise the FK
    // constraint on renewedFromId can reject deleting a predecessor row in the same batch.
    prisma.customerLicense.updateMany({ data: { renewedFromId: null } }),
    prisma.customerLicense.deleteMany(),
    prisma.inventoryStock.deleteMany(),
    prisma.importOrderItem.deleteMany(),
    prisma.importOrder.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.license.deleteMany(),
    prisma.product.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.category.deleteMany(),
    prisma.dashboardKpi.deleteMany(),
  ]);

  const categoryIdByCode = new Map<string, number>();
  for (const category of categories) {
    const record = await prisma.category.create({ data: category });
    categoryIdByCode.set(category.categoryCode, record.categoryId);
  }

  const supplierIdByCode = new Map<string, number>();
  for (const supplier of suppliers) {
    const record = await prisma.supplier.create({ data: supplier });
    supplierIdByCode.set(supplier.supplierCode, record.supplierId);
  }

  const productIdByCode = new Map<string, number>();
  for (const [productCode, productName, categoryCode, supplierCode, abvPercent, packageSizeMl, unit, costPrice, suggestedPrice, stockQty, status] of products) {
    const record = await prisma.product.create({
      data: {
        productCode,
        productName,
        categoryId: categoryIdByCode.get(categoryCode)!,
        supplierId: supplierIdByCode.get(supplierCode)!,
        unit,
        stockQty,
        minStock: status === "LOW_STOCK" ? 24 : 0,
        unitPrice: suggestedPrice,
        costPrice,
        suggestedPrice,
        abvPercent,
        packageSizeMl,
        currency: "JPY",
        status,
        description: `${productName} liquor import demo SKU`,
      },
    });
    productIdByCode.set(productCode, record.productId);
  }

  // Track each order item's generated id as `${orderNo}::${productCode}` so inventory
  // lots below can look up the exact import order item they were received against.
  const importOrderItemIdByKey = new Map<string, number>();
  for (const order of importOrders) {
    const itemRows = order.items.map((item) => ({
      productId: productIdByCode.get(item.productCode)!,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.quantity * item.unitPrice,
    }));
    const created = await prisma.importOrder.create({
      data: {
        orderNo: order.orderNo,
        supplierId: supplierIdByCode.get(order.supplierCode)!,
        country: order.country,
        incoterms: order.incoterms,
        orderDate: date(order.orderDate),
        etaDate: date(order.etaDate),
        skuItemCount: itemRows.length,
        totalValue: itemRows.reduce((sum, row) => sum + row.subtotal, 0),
        status: order.status,
        approver: nullable(order.approver),
        customsEntryNo: nullable(order.customsEntryNo),
        items: { create: itemRows },
      },
      include: { items: true },
    });
    created.items.forEach((item, index) => {
      importOrderItemIdByKey.set(`${order.orderNo}::${order.items[index].productCode}`, item.importOrderItemId);
    });
  }

  for (const [licenseNo, licenseType, holderName, category, issueDate, expiryDate, daysRemaining, status] of licenses) {
    await prisma.license.create({
      data: { licenseNo, licenseType, holderName, category, issueDate: date(issueDate), expiryDate: date(expiryDate), daysRemaining, status },
    });
  }

  const customerIdByCode = new Map<string, number>();
  for (const [customerCode, customerName, channelType, creditLimit, currentBalance, availableCredit, standardDiscount, creditStatus] of customers) {
    const record = await prisma.customer.create({
      data: {
        customerCode,
        customerName,
        channelType,
        creditLimit,
        currentBalance,
        availableCredit,
        standardDiscount,
        creditStatus,
      },
    });
    customerIdByCode.set(customerCode, record.customerId);
  }

  // Each customer's currently-usable license, keyed by customerCode — updated below when
  // CUS-0004's license gets renewed, so historical sales orders reference whichever license
  // is actually on file for that customer today.
  const customerLicenseByCode = new Map<string, { customerLicenseId: number; licenseNumber: string; licenseType: string; expiryDate: Date }>();
  const customerLicenseByNumber = new Map<string, { customerLicenseId: number; licenseNumber: string; licenseType: string; expiryDate: Date }>();
  for (const cl of customerLicenses) {
    const record = await prisma.customerLicense.create({
      data: {
        customerId: customerIdByCode.get(cl.customerCode)!,
        licenseNumber: cl.licenseNumber,
        licenseType: cl.licenseType,
        applicableChannel: cl.applicableChannel,
        issueDate: date(cl.issueDate),
        expiryDate: date(cl.expiryDate),
        status: cl.status,
        createdBy: "System Seed",
        updatedBy: "System Seed",
        statusChangedBy: "System Seed",
        statusChangedAt: new Date(),
      },
    });
    const seededLicense = {
      customerLicenseId: record.customerLicenseId,
      licenseNumber: record.licenseNumber,
      licenseType: record.licenseType,
      expiryDate: record.expiryDate,
    };
    customerLicenseByNumber.set(record.licenseNumber, seededLicense);
    if (record.status === CustomerLicenseStatus.ACTIVE) {
      customerLicenseByCode.set(cl.customerCode, seededLicense);
    }
  }

  // Renewal-chain example: CUS-0004's expired license is renewed through the real
  // CustomerLicenseModel.renew flow (not a raw insert) — the old LIC-SELL-2204 row is kept,
  // marked EXPIRED, and linked to the new ACTIVE LIC-SELL-2204-R1 via renewedFromId.
  const renewedLicense = await CustomerLicenseModel.renew(customerLicenseByNumber.get("LIC-SELL-2204")!.customerLicenseId, {
    licenseNumber: "LIC-SELL-2204-R1",
    issueDate: date("2025-08-15"),
    expiryDate: date("2027-08-14"),
    actor: "System Seed",
  });
  customerLicenseByCode.set("CUS-0004", {
    customerLicenseId: renewedLicense.customerLicenseId,
    licenseNumber: renewedLicense.licenseNumber,
    licenseType: renewedLicense.licenseType,
    expiryDate: renewedLicense.expiryDate,
  });

  for (const order of salesOrders) {
    const itemRows = order.items.map((item) => ({
      productId: productIdByCode.get(item.productCode)!,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      lotBatch: item.lotBatch,
      netValue: item.quantity * item.unitPrice * (1 - item.discount / 100),
    }));
    // CUS-0007 (DrinkHub) has no license on file, so its one order is left unlinked —
    // a legacy record predating strict license enforcement, which the schema tolerates.
    const license = customerLicenseByCode.get(order.customerCode);
    await prisma.salesOrder.create({
      data: {
        orderNo: order.orderNo,
        customerId: customerIdByCode.get(order.customerCode)!,
        deliveryStatus: order.deliveryStatus,
        invoiceNo: order.invoiceNo,
        approver: nullable(order.approver),
        netValue: itemRows.reduce((sum, row) => sum + row.netValue, 0),
        items: { create: itemRows },
        ...(license
          ? {
              customerLicenseId: license.customerLicenseId,
              licenseNumberSnapshot: license.licenseNumber,
              licenseTypeSnapshot: license.licenseType,
              licenseExpirySnapshot: license.expiryDate,
            }
          : {}),
      },
    });
  }

  for (const [productCode, lotBatch, receivedDate, quantityOnHand, stockAgeDays, stockStatus, warehouse, sourceOrderNo] of inventoryStocks) {
    await prisma.inventoryStock.create({
      data: {
        productId: productIdByCode.get(productCode)!,
        importOrderItemId: sourceOrderNo === "-" ? null : importOrderItemIdByKey.get(`${sourceOrderNo}::${productCode}`),
        lotBatch,
        receivedDate: date(receivedDate),
        quantityOnHand,
        stockAgeDays,
        stockStatus,
        warehouse,
      },
    });
  }

  for (const [metricName, currentValue, unit, monthTrend] of dashboardKpis) {
    await prisma.dashboardKpi.create({ data: { metricName, currentValue, unit, monthTrend } });
  }

  for (const [index, stock] of inventoryStocks.entries()) {
    await prisma.stockTransaction.create({
      data: {
        transactionNo: `TX-LIQUOR-${String(index + 1).padStart(3, "0")}`,
        productId: productIdByCode.get(stock[0])!,
        transactionType: TransactionType.IN,
        quantity: stock[3],
        transactionDate: date(stock[2]),
        referenceNo: stock[1],
        note: `Initial lot balance for ${stock[1]}`,
      },
    });
  }

  // --- New-version demo: automatic stock transaction system ---------------------------
  // Everything above is historical scene-setting inserted directly via Prisma. These three
  // records instead go through the real model layer, so they demonstrate the app's current
  // behavior: an import order automatically posts an IN transaction (referenceNo
  // "IO:<orderNo>"), a sales order automatically posts an OUT transaction (referenceNo
  // "SO:<orderNo>"), and a manual stocktake correction shows the individual/manual creation
  // path. All three adjust product.stockQty as a side effect of being recorded.
  await ImportOrderModel.create({
    orderNo: "IMP-2026-0154",
    supplierId: supplierIdByCode.get("SUP-RIVERSIDE")!,
    country: "United States",
    incoterms: "FOB",
    orderDate: date("2026-08-28"),
    etaDate: date("2026-09-02"),
    status: "RECEIVED",
    approver: "Kumiko Sato (Manager)",
    customsEntryNo: "IDN-2026-003350",
    items: [{ productId: productIdByCode.get("SKU-1012")!, quantity: 240, unitPrice: 820 }],
  });

  await SalesOrderModel.create({
    orderNo: "SO-2026-3310",
    customerId: customerIdByCode.get("CUS-0003")!,
    customerLicenseId: customerLicenseByCode.get("CUS-0003")!.customerLicenseId,
    deliveryStatus: "PENDING",
    invoiceNo: "INV-2026-8810",
    items: [
      { productId: productIdByCode.get("SKU-1012")!, quantity: 36, unitPrice: 1250, discount: 5, lotBatch: "LOT-A2608-05" },
      { productId: productIdByCode.get("SKU-1010")!, quantity: 8, unitPrice: 3200, discount: 5, lotBatch: "LOT-A2607-02" },
    ],
  });

  await StockTransactionModel.create({
    transactionNo: "TX-LIQUOR-011",
    productId: productIdByCode.get("SKU-1005")!,
    transactionType: TransactionType.ADJUSTMENT,
    quantity: 6,
    referenceNo: "STOCKTAKE-2026-09",
    note: "Cycle count found 6 extra bottles misplaced on the Warehouse B overflow shelf",
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    throw err;
  });
