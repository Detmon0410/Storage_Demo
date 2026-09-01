import { PrismaClient, TransactionType } from "@prisma/client";

const prisma = new PrismaClient();

const categories = [
  {
    categoryCode: "CAT-PART",
    categoryName: "Part",
    description: "Mechanical and general spare parts",
    isActive: true,
  },
  {
    categoryCode: "CAT-ELEC",
    categoryName: "Electrical",
    description: "Electrical and control components",
    isActive: true,
  },
  {
    categoryCode: "CAT-TOOL",
    categoryName: "Tool",
    description: "Tools and maintenance equipment",
    isActive: true,
  },
  {
    categoryCode: "CAT-CONS",
    categoryName: "Consumable",
    description: "Consumable items used in operation",
    isActive: true,
  },
];

const suppliers = [
  {
    supplierCode: "SUP-001",
    supplierName: "Sakura Industrial Co., Ltd.",
    contactName: "Haruto Sato",
    email: "sales@sakura-example.jp",
    phone: "03-5555-0101",
    status: "ACTIVE",
  },
  {
    supplierCode: "SUP-002",
    supplierName: "Tokyo Cooling Parts",
    contactName: "Yuki Tanaka",
    email: "contact@tokyo-cooling.example.jp",
    phone: "03-5555-0102",
    status: "ACTIVE",
  },
  {
    supplierCode: "SUP-003",
    supplierName: "Japan Industrial Refrigeration Equipment Manufacturing",
    contactName: "Aoi Suzuki",
    email: "order@jirem-example.jp",
    phone: "06-5555-0103",
    status: "ACTIVE",
  },
  {
    supplierCode: "SUP-004",
    supplierName: "Demo Supplier (Inactive)",
    contactName: "Demo User",
    email: "demo@example.com",
    phone: "00-0000-0000",
    status: "INACTIVE",
  },
];

const products = [
  {
    productCode: "PRD-001",
    productName: "Compressor 1HP",
    categoryCode: "CAT-PART",
    supplierCode: "SUP-001",
    unit: "PCS",
    stockQty: 10,
    minStock: 5,
    unitPrice: 15000,
    currency: "JPY",
    status: "IN_STOCK",
    description: "Normal stock example",
  },
  {
    productCode: "PRD-002",
    productName: "Cooling Fan 120mm",
    categoryCode: "CAT-PART",
    supplierCode: "SUP-002",
    unit: "PCS",
    stockQty: 2,
    minStock: 5,
    unitPrice: 3500,
    currency: "JPY",
    status: "LOW_STOCK",
    description: "Low stock example",
  },
  {
    productCode: "PRD-003",
    productName: "Control Board X100",
    categoryCode: "CAT-ELEC",
    supplierCode: "SUP-003",
    unit: "PCS",
    stockQty: 0,
    minStock: 2,
    unitPrice: 22000,
    currency: "JPY",
    status: "OUT_OF_STOCK",
    description: "Out of stock example",
  },
  {
    productCode: "PRD-004",
    productName: "Temperature Sensor",
    categoryCode: "CAT-ELEC",
    supplierCode: "SUP-002",
    unit: "PCS",
    stockQty: 25,
    minStock: 10,
    unitPrice: 1200,
    currency: "JPY",
    status: "IN_STOCK",
    description: "Normal electrical item",
  },
  {
    productCode: "PRD-005",
    productName: "Vacuum Pump Maintenance Tool Set",
    categoryCode: "CAT-TOOL",
    supplierCode: "SUP-001",
    unit: "SET",
    stockQty: 4,
    minStock: 2,
    unitPrice: 48000,
    currency: "JPY",
    status: "IN_STOCK",
    description: "Long product name for UI layout test",
  },
  {
    productCode: "PRD-006",
    productName: "Refrigerant Service Consumable Pack",
    categoryCode: "CAT-CONS",
    supplierCode: "SUP-003",
    unit: "PACK",
    stockQty: 5,
    minStock: 5,
    unitPrice: 8900,
    currency: "JPY",
    status: "LOW_STOCK",
    description: "Stock equals minimum stock",
  },
  {
    productCode: "PRD-007",
    productName: "Demo Discontinued Part",
    categoryCode: "CAT-PART",
    supplierCode: "SUP-004",
    unit: "PCS",
    stockQty: 0,
    minStock: 0,
    unitPrice: 500,
    currency: "JPY",
    status: "INACTIVE",
    description: "Inactive product example",
  },
];

const stockTransactions = [
  {
    transactionNo: "TX-20260901-001",
    productCode: "PRD-001",
    transactionType: TransactionType.IN,
    quantity: 5,
    transactionDate: new Date("2026-08-20"),
    referenceNo: "PO-2026-001",
    note: "Initial receiving",
  },
  {
    transactionNo: "TX-20260901-002",
    productCode: "PRD-002",
    transactionType: TransactionType.OUT,
    quantity: 3,
    transactionDate: new Date("2026-08-25"),
    referenceNo: "REQ-2026-011",
    note: "Used for maintenance",
  },
  {
    transactionNo: "TX-20260901-003",
    productCode: "PRD-003",
    transactionType: TransactionType.OUT,
    quantity: 2,
    transactionDate: new Date("2026-08-28"),
    referenceNo: "REQ-2026-012",
    note: "Stock became zero",
  },
  {
    transactionNo: "TX-20260901-004",
    productCode: "PRD-004",
    transactionType: TransactionType.IN,
    quantity: 10,
    transactionDate: new Date("2026-08-30"),
    referenceNo: "PO-2026-014",
    note: "Supplier delivery",
  },
  {
    transactionNo: "TX-20260901-005",
    productCode: "PRD-006",
    transactionType: TransactionType.OUT,
    quantity: 5,
    transactionDate: new Date("2026-09-01"),
    referenceNo: "REQ-2026-015",
    note: "Reached minimum stock",
  },
];

async function main() {
  const categoryIdByCode = new Map<string, number>();
  for (const category of categories) {
    const record = await prisma.category.upsert({
      where: { categoryCode: category.categoryCode },
      update: category,
      create: category,
    });
    categoryIdByCode.set(category.categoryCode, record.categoryId);
  }

  const supplierIdByCode = new Map<string, number>();
  for (const supplier of suppliers) {
    const record = await prisma.supplier.upsert({
      where: { supplierCode: supplier.supplierCode },
      update: supplier,
      create: supplier,
    });
    supplierIdByCode.set(supplier.supplierCode, record.supplierId);
  }

  const productIdByCode = new Map<string, number>();
  for (const { categoryCode, supplierCode, ...product } of products) {
    const data = {
      ...product,
      categoryId: categoryIdByCode.get(categoryCode)!,
      supplierId: supplierIdByCode.get(supplierCode)!,
    };
    const record = await prisma.product.upsert({
      where: { productCode: product.productCode },
      update: data,
      create: data,
    });
    productIdByCode.set(product.productCode, record.productId);
  }

  for (const { productCode, ...transaction } of stockTransactions) {
    const data = { ...transaction, productId: productIdByCode.get(productCode)! };
    await prisma.stockTransaction.upsert({
      where: { transactionNo: transaction.transactionNo },
      update: data,
      create: data,
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    throw err;
  });
