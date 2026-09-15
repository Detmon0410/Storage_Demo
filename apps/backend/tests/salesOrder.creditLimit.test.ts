import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

describe("Sales order credit-limit soft-block and deferred decrement (ENFORCE-03)", () => {
  let accessToken: string;
  let approverAccessToken: string;
  let categoryId: number;
  let supplierId: number;
  let productId: number;
  let customerId: number;
  let customerLicenseId: number;
  const createdOrderNos: string[] = [];
  const createdInventoryStockIds: number[] = [];

  beforeAll(async () => {
    const { username, password } = await createTestUserWithRoles("credlimit_officer", ["SALES_OFFICER"]);
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    accessToken = loginRes.body.accessToken;

    const approver = await createTestUserWithRoles("credlimit_approver", ["MANAGER_APPROVER"]);
    const approverLoginRes = await request(app).post("/api/auth/login").send({ username: approver.username, password: approver.password });
    approverAccessToken = approverLoginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { categoryCode: `TEST_CREDLIM_CAT_${Date.now()}`, categoryName: "Credit Limit Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_CREDLIM_SUP_${Date.now()}`, supplierName: "Credit Limit Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const product = await prisma.product.create({
      data: {
        productCode: `TEST_CREDLIM_PROD_${Date.now()}`,
        productName: "Credit Limit Test Product",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 1000,
        unitPrice: 50,
        status: "active",
      },
    });
    productId = product.productId;

    const customer = await prisma.customer.create({
      data: {
        customerCode: `TEST_CREDLIM_CUST_${Date.now()}`,
        customerName: "Credit Limit Test Customer",
        channelType: "RETAIL",
        creditLimit: 1000,
        currentBalance: 900,
        availableCredit: 100,
        standardDiscount: 50,
        creditStatus: "GOOD",
      },
    });
    customerId = customer.customerId;

    const customerLicense = await prisma.customerLicense.create({
      data: {
        customerId,
        licenseNumber: `TEST_CREDLIM_CUSTLIC_${Date.now()}`,
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

  it("soft-blocks an order that would push balance over the credit limit (201, requiresApproval: true, no decrement yet)", async () => {
    const inventoryStock = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_CREDLIM_LOT_OVER_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 100,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    createdInventoryStockIds.push(inventoryStock.inventoryStockId);
    const inventoryStockId = inventoryStock.inventoryStockId;

    const orderNo = `TEST_CREDLIM_OVER_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 10, unitPrice: 50, discount: 0, inventoryStockId }],
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

  it("performs the deferred decrement exactly once when a different MANAGER_APPROVER approves an over-limit order", async () => {
    const inventoryStock = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_CREDLIM_LOT_APPROVE_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 100,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    createdInventoryStockIds.push(inventoryStock.inventoryStockId);
    const inventoryStockId = inventoryStock.inventoryStockId;

    const orderNo = `TEST_CREDLIM_APPROVE_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 10, unitPrice: 50, discount: 0, inventoryStockId }],
      });
    expect(res.status).toBe(201);
    expect(res.body.requiresApproval).toBe(true);
    createdOrderNos.push(orderNo);

    const referenceNo = `SO:${orderNo}`;

    const approveRes = await request(app)
      .post(`/api/sales-orders/${res.body.salesOrderId}/approve`)
      .set("Authorization", `Bearer ${approverAccessToken}`)
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.requiresApproval).toBe(false);

    const lotAfterApprove = await prisma.inventoryStock.findUnique({ where: { inventoryStockId } });
    expect(lotAfterApprove?.quantityOnHand).toBe(90);

    const stockTxnsAfterApprove = await prisma.stockTransaction.findMany({ where: { referenceNo } });
    expect(stockTxnsAfterApprove.length).toBeGreaterThan(0);
  });

  it("does not require approval and decrements immediately for an order well within the credit limit", async () => {
    const inventoryStock = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_CREDLIM_LOT_OK_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 100,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    createdInventoryStockIds.push(inventoryStock.inventoryStockId);
    const inventoryStockId = inventoryStock.inventoryStockId;

    const orderNo = `TEST_CREDLIM_OK_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 1, unitPrice: 10, discount: 0, inventoryStockId }],
      });

    expect(res.status).toBe(201);
    expect(res.body.requiresApproval).toBe(false);
    createdOrderNos.push(orderNo);

    const lot = await prisma.inventoryStock.findUnique({ where: { inventoryStockId } });
    expect(lot?.quantityOnHand).toBe(99);
  });
});
