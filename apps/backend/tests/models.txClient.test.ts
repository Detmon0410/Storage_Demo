import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./setup.js";
import { ImportOrderModel } from "../src/models/importOrder.model.js";
import { SalesOrderModel } from "../src/models/salesOrder.model.js";
import { StockTransactionModel } from "../src/models/stockTransaction.model.js";

describe("Model tx-client injection regression", () => {
  let categoryId: number;
  let supplierId: number;
  let importProductId: number;
  let salesProductId: number;
  let stockProductId: number;
  let customerId: number;
  let customerLicenseId: number;
  const createdImportOrderNos: string[] = [];
  const createdSalesOrderNos: string[] = [];
  const createdStockTransactionNos: string[] = [];

  beforeAll(async () => {
    const category = await prisma.category.create({
      data: { categoryCode: `TEST_TXCL_CAT_${Date.now()}`, categoryName: "Tx Client Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_TXCL_SUP_${Date.now()}`, supplierName: "Tx Client Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const importProduct = await prisma.product.create({
      data: {
        productCode: `TEST_TXCL_PROD_IMP_${Date.now()}`,
        productName: "Tx Client Test Product (import)",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 0,
        unitPrice: 10,
        status: "active",
      },
    });
    importProductId = importProduct.productId;

    const salesProduct = await prisma.product.create({
      data: {
        productCode: `TEST_TXCL_PROD_SALE_${Date.now()}`,
        productName: "Tx Client Test Product (sales)",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 1000,
        unitPrice: 10,
        status: "active",
      },
    });
    salesProductId = salesProduct.productId;

    const stockProduct = await prisma.product.create({
      data: {
        productCode: `TEST_TXCL_PROD_STOCK_${Date.now()}`,
        productName: "Tx Client Test Product (stock)",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 100,
        unitPrice: 10,
        status: "active",
      },
    });
    stockProductId = stockProduct.productId;

    const customer = await prisma.customer.create({
      data: {
        customerCode: `TEST_TXCL_CUST_${Date.now()}`,
        customerName: "Tx Client Test Customer",
        channelType: "RETAIL",
        creditLimit: 100000,
        currentBalance: 0,
        availableCredit: 100000,
        standardDiscount: 0,
        creditStatus: "GOOD",
      },
    });
    customerId = customer.customerId;

    const customerLicense = await prisma.customerLicense.create({
      data: {
        customerId,
        licenseNumber: `TEST_TXCL_CUSTLIC_${Date.now()}`,
        licenseType: "Retail",
        issueDate: new Date(Date.now() - 100 * 86400000),
        expiryDate: new Date(Date.now() + 400 * 86400000),
        status: "ACTIVE",
      },
    });
    customerLicenseId = customerLicense.customerLicenseId;
  });

  afterAll(async () => {
    await prisma.stockTransaction.deleteMany({
      where: {
        OR: [
          { referenceNo: { in: [...createdImportOrderNos, ...createdSalesOrderNos].map((n) => `${n}`) } },
          { transactionNo: { in: createdStockTransactionNos } },
          { productId: { in: [importProductId, salesProductId, stockProductId] } },
        ],
      },
    });
    await prisma.salesOrder.deleteMany({ where: { orderNo: { in: createdSalesOrderNos } } });
    await prisma.importOrder.deleteMany({ where: { orderNo: { in: createdImportOrderNos } } });
    await prisma.customerLicense.deleteMany({ where: { customerLicenseId } });
    await prisma.customer.deleteMany({ where: { customerId } });
    await prisma.product.deleteMany({ where: { productId: { in: [importProductId, salesProductId, stockProductId] } } });
    await prisma.supplier.deleteMany({ where: { supplierId } });
    await prisma.category.deleteMany({ where: { categoryId } });
  });

  it("ImportOrderModel.create with no client arg still creates the order and its linked IN stock transaction (standalone behavior unchanged)", async () => {
    const orderNo = `TEST_TXCL_IMP_${Date.now()}`;
    const order = await ImportOrderModel.create({
      orderNo,
      supplierId,
      country: "Scotland",
      incoterms: "FOB",
      orderDate: new Date(),
      etaDate: new Date(Date.now() + 30 * 86400000),
      status: "RECEIVED",
      items: [{ productId: importProductId, quantity: 5, unitPrice: 10 }],
    });
    createdImportOrderNos.push(orderNo);

    expect(order.orderNo).toBe(orderNo);

    const stockTx = await prisma.stockTransaction.findMany({ where: { referenceNo: { contains: orderNo } } });
    expect(stockTx.length).toBeGreaterThan(0);
    expect(stockTx[0].transactionType).toBe("IN");
  });

  it("SalesOrderModel.create with no client arg still works against a seeded customer+license+product", async () => {
    const orderNo = `TEST_TXCL_SALE_${Date.now()}`;
    const order = await SalesOrderModel.create({
      orderNo,
      customerId,
      customerLicenseId,
      deliveryStatus: "PENDING",
      invoiceNo: `INV-${orderNo}`,
      items: [{ productId: salesProductId, quantity: 2, unitPrice: 10, discount: 0, lotBatch: "LOT-1" }],
    });
    createdSalesOrderNos.push(orderNo);

    expect(order.orderNo).toBe(orderNo);

    const stockTx = await prisma.stockTransaction.findMany({ where: { referenceNo: { contains: orderNo } } });
    expect(stockTx.length).toBeGreaterThan(0);
    expect(stockTx[0].transactionType).toBe("OUT");
  });

  it("StockTransactionModel.create with no client arg still creates a transaction and updates product.stockQty", async () => {
    const transactionNo = `TEST_TXCL_STOCK_${Date.now()}`;
    createdStockTransactionNos.push(transactionNo);
    const before = await prisma.product.findUnique({ where: { productId: stockProductId }, select: { stockQty: true } });

    const transaction = await StockTransactionModel.create({
      transactionNo,
      productId: stockProductId,
      transactionType: "IN",
      quantity: 10,
    });

    expect(transaction.transactionNo).toBe(transactionNo);

    const after = await prisma.product.findUnique({ where: { productId: stockProductId }, select: { stockQty: true } });
    expect(after!.stockQty).toBe(before!.stockQty + 10);
  });

  it("passing an explicit prisma.$transaction(tx) into ImportOrderModel.create does not throw (tx-injection path is reachable, does not nest)", async () => {
    const orderNo = `TEST_TXCL_IMP_TXJOIN_${Date.now()}`;
    const result = await prisma.$transaction(async (tx) =>
      ImportOrderModel.create(
        {
          orderNo,
          supplierId,
          country: "Scotland",
          incoterms: "FOB",
          orderDate: new Date(),
          etaDate: new Date(Date.now() + 30 * 86400000),
          status: "PENDING",
          items: [{ productId: importProductId, quantity: 3, unitPrice: 10 }],
        },
        tx,
      ),
    );
    expect(result.orderNo).toBe(orderNo);
    createdImportOrderNos.push(orderNo);
  });
});
