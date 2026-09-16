import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

describe("Sales order line-item and deliveryStatus validation (ENFORCE-05)", () => {
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
    const { username, password } = await createTestUserWithRoles("inputval_officer", ["SALES_OFFICER"]);
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    accessToken = loginRes.body.accessToken;

    const approver = await createTestUserWithRoles("inputval_approver", ["MANAGER_APPROVER"]);
    const approverLoginRes = await request(app).post("/api/auth/login").send({ username: approver.username, password: approver.password });
    approverAccessToken = approverLoginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { categoryCode: `TEST_INVAL_CAT_${Date.now()}`, categoryName: "Input Validation Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_INVAL_SUP_${Date.now()}`, supplierName: "Input Validation Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const product = await prisma.product.create({
      data: {
        productCode: `TEST_INVAL_PROD_${Date.now()}`,
        productName: "Input Validation Test Product",
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
        customerCode: `TEST_INVAL_CUST_${Date.now()}`,
        customerName: "Input Validation Test Customer",
        channelType: "RETAIL",
        creditLimit: 1000000,
        currentBalance: 0,
        availableCredit: 1000000,
        standardDiscount: 50,
        creditStatus: "GOOD",
      },
    });
    customerId = customer.customerId;

    const customerLicense = await prisma.customerLicense.create({
      data: {
        customerId,
        licenseNumber: `TEST_INVAL_CUSTLIC_${Date.now()}`,
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

  const makeLot = async (suffix: string) => {
    const inventoryStock = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_INVAL_LOT_${suffix}_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 100,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    createdInventoryStockIds.push(inventoryStock.inventoryStockId);
    return inventoryStock.inventoryStockId;
  };

  it("rejects an item with a non-positive quantity", async () => {
    const inventoryStockId = await makeLot("NEGQTY");
    const orderNo = `TEST_INVAL_NEGQTY_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: -1, unitPrice: 10, discount: 0, inventoryStockId }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("positive");
  });

  it("rejects an item with a negative unitPrice", async () => {
    const inventoryStockId = await makeLot("NEGPRICE");
    const orderNo = `TEST_INVAL_NEGPRICE_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 1, unitPrice: -5, discount: 0, inventoryStockId }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("negative");
  });

  it("rejects an item with a discount over 100", async () => {
    const inventoryStockId = await makeLot("DISCOVER");
    const orderNo = `TEST_INVAL_DISCOVER_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 1, unitPrice: 10, discount: 150, inventoryStockId }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("between 0 and 100");
  });

  it("rejects an item missing inventoryStockId", async () => {
    const orderNo = `TEST_INVAL_NOLOT_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 1, unitPrice: 10, discount: 0 }],
      });
    expect(res.status).toBe(400);
  });

  it("rejects an unknown deliveryStatus value on create", async () => {
    const inventoryStockId = await makeLot("BOGUS");
    const orderNo = `TEST_INVAL_BOGUS_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "BOGUS",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 1, unitPrice: 10, discount: 0, inventoryStockId }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("invalid deliverystatus");
  });

  it("rejects status APPROVED on create, even for a caller without approve permission", async () => {
    const inventoryStockId = await makeLot("BYPASS");
    const orderNo = `TEST_INVAL_BYPASS_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        status: "APPROVED",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 1, unitPrice: 10, discount: 0, inventoryStockId }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("dedicated approve/reject endpoint");
  });

  it("rejects status REJECTED on create", async () => {
    const inventoryStockId = await makeLot("BYPASSREJ");
    const orderNo = `TEST_INVAL_BYPASSREJ_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        status: "REJECTED",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 1, unitPrice: 10, discount: 0, inventoryStockId }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("dedicated approve/reject endpoint");
  });

  it("rejects a backward deliveryStatus transition (DELIVERED -> PENDING)", async () => {
    const inventoryStockId = await makeLot("BACKWARD");
    const orderNo = `TEST_INVAL_BACKWARD_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "DELIVERED",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 1, unitPrice: 10, discount: 0, inventoryStockId }],
      });
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);

    const updateRes = await request(app)
      .put(`/api/sales-orders/${createRes.body.salesOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ deliveryStatus: "PENDING" });
    expect(updateRes.status).toBe(400);
    expect(updateRes.body.error.toLowerCase()).toContain("invalid status transition");
  });

  it("rejects skipping DELIVERED en route to RETURNED (PENDING -> RETURNED)", async () => {
    const inventoryStockId = await makeLot("SKIP");
    const orderNo = `TEST_INVAL_SKIP_${Date.now()}`;
    const createRes = await request(app)
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
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);

    const updateRes = await request(app)
      .put(`/api/sales-orders/${createRes.body.salesOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ deliveryStatus: "RETURNED" });
    expect(updateRes.status).toBe(400);
    expect(updateRes.body.error.toLowerCase()).toContain("invalid status transition");
  });

  it("allows deliveryStatus changes after an order's approval status is APPROVED (deliveryStatus pipeline is independent of the approval status per D-03)", async () => {
    const inventoryStockId = await makeLot("TERMINAL");
    const orderNo = `TEST_INVAL_TERMINAL_${Date.now()}`;
    const createRes = await request(app)
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
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);
    const salesOrderId = createRes.body.salesOrderId;

    const approveRes = await request(app)
      .post(`/api/sales-orders/${salesOrderId}/approve`)
      .set("Authorization", `Bearer ${approverAccessToken}`)
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("APPROVED");
    expect(approveRes.body.deliveryStatus).toBe("PENDING");

    const updateRes = await request(app)
      .put(`/api/sales-orders/${salesOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ deliveryStatus: "SHIPPING" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.deliveryStatus).toBe("SHIPPING");
  });

  it("accepts a valid forward transition (PENDING -> SHIPPING) with no items key (positive control)", async () => {
    const inventoryStockId = await makeLot("FORWARD");
    const orderNo = `TEST_INVAL_FORWARD_${Date.now()}`;
    const createRes = await request(app)
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
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);

    const updateRes = await request(app)
      .put(`/api/sales-orders/${createRes.body.salesOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ deliveryStatus: "SHIPPING" });
    expect(updateRes.status).toBe(200);
  });
});
