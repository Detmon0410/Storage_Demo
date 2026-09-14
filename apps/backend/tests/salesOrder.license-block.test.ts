import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUser } from "./fixtures/testUser.js";

describe("Sales order backend license-expiry blocking", () => {
  let accessToken: string;
  let categoryId: number;
  let supplierId: number;
  let customerId: number;
  let customerLicenseId: number;
  let expiredPermitProductId: number;
  let cleanProductId: number;
  const createdOrderNos: string[] = [];
  const createdLicenseIds: number[] = [];

  beforeAll(async () => {
    const { username, password } = await createTestUser("salesorder_license_block");
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    accessToken = loginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { categoryCode: `TEST_SOLB_CAT_${Date.now()}`, categoryName: "Sales License Block Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_SOLB_SUP_${Date.now()}`, supplierName: "Sales License Block Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const expiredPermitProduct = await prisma.product.create({
      data: {
        productCode: `TEST_SOLB_PROD_EXP_${Date.now()}`,
        productName: "Sales License Block Test Product (expired permit)",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 1000,
        unitPrice: 10,
        status: "active",
      },
    });
    expiredPermitProductId = expiredPermitProduct.productId;

    const cleanProduct = await prisma.product.create({
      data: {
        productCode: `TEST_SOLB_PROD_OK_${Date.now()}`,
        productName: "Sales License Block Test Product (no license)",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 1000,
        unitPrice: 10,
        status: "active",
      },
    });
    cleanProductId = cleanProduct.productId;

    const expiredLicense = await prisma.license.create({
      data: {
        licenseNo: `TEST_SOLB_LIC_${Date.now()}`,
        licenseType: "Import",
        holderName: "Test Holder",
        category: "Test",
        issueDate: new Date(Date.now() - 400 * 86400000),
        expiryDate: new Date(Date.now() - 10 * 86400000),
        productId: expiredPermitProductId,
      },
    });
    createdLicenseIds.push(expiredLicense.licenseId);

    const customer = await prisma.customer.create({
      data: {
        customerCode: `TEST_SOLB_CUST_${Date.now()}`,
        customerName: "Sales License Block Test Customer",
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
        licenseNumber: `TEST_SOLB_CUSTLIC_${Date.now()}`,
        licenseType: "Retail",
        issueDate: new Date(Date.now() - 100 * 86400000),
        expiryDate: new Date(Date.now() + 400 * 86400000),
        status: "ACTIVE",
      },
    });
    customerLicenseId = customerLicense.customerLicenseId;
  });

  afterAll(async () => {
    await prisma.salesOrder.deleteMany({ where: { orderNo: { in: createdOrderNos } } });
    await prisma.customerLicense.deleteMany({ where: { customerLicenseId } });
    await prisma.customer.deleteMany({ where: { customerId } });
    await prisma.license.deleteMany({ where: { licenseId: { in: createdLicenseIds } } });
    await prisma.stockTransaction.deleteMany({ where: { productId: { in: [expiredPermitProductId, cleanProductId] } } });
    await prisma.product.deleteMany({ where: { productId: { in: [expiredPermitProductId, cleanProductId] } } });
    await prisma.supplier.deleteMany({ where: { supplierId } });
    await prisma.category.deleteMany({ where: { categoryId } });
    await cleanupTestUsers();
  });

  it("returns 400 with a message mentioning 'expired permit' when creating a sales order for an expired-permit product", async () => {
    const orderNo = `TEST_SOLB_ORDER_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId: expiredPermitProductId, quantity: 2, unitPrice: 10, discount: 0, lotBatch: "LOT-1" }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("expired permit");

    const persisted = await prisma.salesOrder.findUnique({ where: { orderNo } });
    expect(persisted).toBeNull();
  });

  it("returns 201 for a sales order with a product that has no linked License", async () => {
    const orderNo = `TEST_SOLB_ORDER_OK_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId: cleanProductId, quantity: 2, unitPrice: 10, discount: 0, lotBatch: "LOT-1" }],
      });

    expect(res.status).toBe(201);
    createdOrderNos.push(orderNo);
  });

  it("returns 400 on PUT when adding a new line item for the expired-permit product to an existing order", async () => {
    const orderNo = `TEST_SOLB_ORDER_UPD_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId: cleanProductId, quantity: 2, unitPrice: 10, discount: 0, lotBatch: "LOT-1" }],
      });
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);
    const salesOrderId = createRes.body.salesOrderId;

    const updateRes = await request(app)
      .put(`/api/sales-orders/${salesOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        items: [
          { productId: cleanProductId, quantity: 2, unitPrice: 10, discount: 0, lotBatch: "LOT-1" },
          { productId: expiredPermitProductId, quantity: 1, unitPrice: 10, discount: 0, lotBatch: "LOT-2" },
        ],
      });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.error.toLowerCase()).toContain("expired permit");
  });
});
