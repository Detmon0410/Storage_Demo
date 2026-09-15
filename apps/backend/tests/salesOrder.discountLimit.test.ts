import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

describe("Sales order discount-limit soft-block and deferred decrement (ENFORCE-04)", () => {
  let accessToken: string;
  let categoryId: number;
  let supplierId: number;
  let productId: number;
  let customerId: number;
  let customerLicenseId: number;
  const createdOrderNos: string[] = [];
  const createdInventoryStockIds: number[] = [];

  beforeAll(async () => {
    const { username, password } = await createTestUserWithRoles("disclimit_officer", ["SALES_OFFICER"]);
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    accessToken = loginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { categoryCode: `TEST_DISCLIM_CAT_${Date.now()}`, categoryName: "Discount Limit Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_DISCLIM_SUP_${Date.now()}`, supplierName: "Discount Limit Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const product = await prisma.product.create({
      data: {
        productCode: `TEST_DISCLIM_PROD_${Date.now()}`,
        productName: "Discount Limit Test Product",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 1000,
        unitPrice: 10,
        status: "active",
      },
    });
    productId = product.productId;

    const customer = await prisma.customer.create({
      data: {
        customerCode: `TEST_DISCLIM_CUST_${Date.now()}`,
        customerName: "Discount Limit Test Customer",
        channelType: "RETAIL",
        creditLimit: 100000,
        currentBalance: 0,
        availableCredit: 100000,
        standardDiscount: 5,
        creditStatus: "GOOD",
      },
    });
    customerId = customer.customerId;

    const customerLicense = await prisma.customerLicense.create({
      data: {
        customerId,
        licenseNumber: `TEST_DISCLIM_CUSTLIC_${Date.now()}`,
        licenseType: "Retail",
        issueDate: new Date(Date.now() - 100 * 86400000),
        expiryDate: new Date(Date.now() + 400 * 86400000),
        status: "ACTIVE",
      },
    });
    customerLicenseId = customerLicense.customerLicenseId;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entity: "SalesOrder" } });
    await prisma.stockTransaction.deleteMany({ where: { productId } });
    await prisma.salesOrder.deleteMany({ where: { orderNo: { in: createdOrderNos } } });
    await prisma.inventoryStock.deleteMany({ where: { inventoryStockId: { in: createdInventoryStockIds } } });
    await prisma.customerLicense.deleteMany({ where: { customerLicenseId } });
    await prisma.customer.deleteMany({ where: { customerId } });
    await prisma.product.deleteMany({ where: { productId } });
    await prisma.supplier.deleteMany({ where: { supplierId } });
    await prisma.category.deleteMany({ where: { categoryId } });
    await cleanupTestUsers();
  });

  it("soft-blocks an order with a line discount above the customer's standardDiscount (201, requiresApproval: true, no decrement yet)", async () => {
    const inventoryStock = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_DISCLIM_LOT_OVER_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 100,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    createdInventoryStockIds.push(inventoryStock.inventoryStockId);
    const inventoryStockId = inventoryStock.inventoryStockId;

    const orderNo = `TEST_DISCLIM_OVER_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 5, unitPrice: 10, discount: 20, inventoryStockId }],
      });

    expect(res.status).toBe(201);
    expect(res.body.requiresApproval).toBe(true);
    createdOrderNos.push(orderNo);

    const lot = await prisma.inventoryStock.findUnique({ where: { inventoryStockId } });
    expect(lot?.quantityOnHand).toBe(100);

    const referenceNo = `SO:${orderNo}`;
    const stockTxns = await prisma.stockTransaction.findMany({ where: { referenceNo } });
    expect(stockTxns.length).toBe(0);
  });

  it("does not require approval for a discount exactly at the customer's standardDiscount limit", async () => {
    const inventoryStock = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_DISCLIM_LOT_EXACT_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 100,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    createdInventoryStockIds.push(inventoryStock.inventoryStockId);
    const inventoryStockId = inventoryStock.inventoryStockId;

    const orderNo = `TEST_DISCLIM_EXACT_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 5, unitPrice: 10, discount: 5, inventoryStockId }],
      });

    expect(res.status).toBe(201);
    expect(res.body.requiresApproval).toBe(false);
    createdOrderNos.push(orderNo);

    const lot = await prisma.inventoryStock.findUnique({ where: { inventoryStockId } });
    expect(lot?.quantityOnHand).toBe(95);
  });

  it("soft-blocks when any single line exceeds the standardDiscount even if other lines are within it", async () => {
    const inventoryStock = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_DISCLIM_LOT_MIX_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 100,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    createdInventoryStockIds.push(inventoryStock.inventoryStockId);
    const inventoryStockId = inventoryStock.inventoryStockId;

    const orderNo = `TEST_DISCLIM_MIX_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [
          { productId, quantity: 2, unitPrice: 10, discount: 5, inventoryStockId },
          { productId, quantity: 1, unitPrice: 10, discount: 10, inventoryStockId },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.requiresApproval).toBe(true);
    createdOrderNos.push(orderNo);
  });
});
