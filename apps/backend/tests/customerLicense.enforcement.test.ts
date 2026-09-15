import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

describe("Sales order CustomerLicense status enforcement beyond expiry (ENFORCE-01)", () => {
  let accessToken: string;
  let categoryId: number;
  let supplierId: number;
  let productId: number;
  let customerId: number;
  let inventoryStockId: number;
  const createdOrderNos: string[] = [];
  const createdLicenseIds: number[] = [];

  beforeAll(async () => {
    const { username, password } = await createTestUserWithRoles("custlic_officer", ["SALES_OFFICER"]);
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    accessToken = loginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { categoryCode: `TEST_CUSTLIC_CAT_${Date.now()}`, categoryName: "CustomerLicense Enforcement Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_CUSTLIC_SUP_${Date.now()}`, supplierName: "CustomerLicense Enforcement Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const product = await prisma.product.create({
      data: {
        productCode: `TEST_CUSTLIC_PROD_${Date.now()}`,
        productName: "CustomerLicense Enforcement Test Product",
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
        customerCode: `TEST_CUSTLIC_CUST_${Date.now()}`,
        customerName: "CustomerLicense Enforcement Test Customer",
        channelType: "RETAIL",
        creditLimit: 100000,
        currentBalance: 0,
        availableCredit: 100000,
        standardDiscount: 50,
        creditStatus: "GOOD",
      },
    });
    customerId = customer.customerId;

    const inventoryStock = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_CUSTLIC_LOT_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 100,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    inventoryStockId = inventoryStock.inventoryStockId;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entity: "SalesOrder" } });
    await prisma.stockTransaction.deleteMany({ where: { productId } });
    await prisma.salesOrder.deleteMany({ where: { orderNo: { in: createdOrderNos } } });
    await prisma.inventoryStock.deleteMany({ where: { inventoryStockId } });
    await prisma.customerLicense.deleteMany({ where: { customerLicenseId: { in: createdLicenseIds } } });
    await prisma.customer.deleteMany({ where: { customerId } });
    await prisma.product.deleteMany({ where: { productId } });
    await prisma.supplier.deleteMany({ where: { supplierId } });
    await prisma.category.deleteMany({ where: { categoryId } });
    await cleanupTestUsers();
  });

  const makeLicense = async (status: "REVOKED" | "SUSPENDED" | "PENDING") => {
    const license = await prisma.customerLicense.create({
      data: {
        customerId,
        licenseNumber: `TEST_CUSTLIC_${status}_${Date.now()}`,
        licenseType: "Retail",
        issueDate: new Date(Date.now() - 100 * 86400000),
        expiryDate: new Date(Date.now() + 400 * 86400000),
        status,
      },
    });
    createdLicenseIds.push(license.customerLicenseId);
    return license.customerLicenseId;
  };

  it("blocks a sales order referencing a REVOKED customer license", async () => {
    const customerLicenseId = await makeLicense("REVOKED");
    const orderNo = `TEST_CUSTLIC_REVOKED_${Date.now()}`;
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
    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("not active");
  });

  it("blocks a sales order referencing a SUSPENDED customer license", async () => {
    const customerLicenseId = await makeLicense("SUSPENDED");
    const orderNo = `TEST_CUSTLIC_SUSPENDED_${Date.now()}`;
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
    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("not active");
  });

  it("blocks a sales order referencing a PENDING (not yet active) customer license", async () => {
    const customerLicenseId = await makeLicense("PENDING");
    const orderNo = `TEST_CUSTLIC_PENDING_${Date.now()}`;
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
    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("not active");
  });

  it("blocks a sales order with no customerLicenseId supplied at all", async () => {
    const orderNo = `TEST_CUSTLIC_MISSING_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 1, unitPrice: 10, discount: 0, inventoryStockId }],
      });
    expect(res.status).toBe(400);
  });
});
