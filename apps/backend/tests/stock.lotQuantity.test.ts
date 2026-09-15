import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

describe("Sales order lot-quantity enforcement (ENFORCE-02)", () => {
  let accessToken: string;
  let categoryId: number;
  let supplierId: number;
  let productId: number;
  let customerId: number;
  let customerLicenseId: number;
  let inventoryStockId: number;
  const createdOrderNos: string[] = [];

  beforeAll(async () => {
    const { username, password } = await createTestUserWithRoles("stock_lotqty", ["SALES_OFFICER"]);
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    accessToken = loginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { categoryCode: `TEST_LOTQTY_CAT_${Date.now()}`, categoryName: "Lot Quantity Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_LOTQTY_SUP_${Date.now()}`, supplierName: "Lot Quantity Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const product = await prisma.product.create({
      data: {
        productCode: `TEST_LOTQTY_PROD_${Date.now()}`,
        productName: "Lot Quantity Test Product",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 100,
        unitPrice: 10,
        status: "active",
      },
    });
    productId = product.productId;

    const customer = await prisma.customer.create({
      data: {
        customerCode: `TEST_LOTQTY_CUST_${Date.now()}`,
        customerName: "Lot Quantity Test Customer",
        channelType: "RETAIL",
        creditLimit: 100000,
        currentBalance: 0,
        availableCredit: 100000,
        standardDiscount: 50,
        creditStatus: "GOOD",
      },
    });
    customerId = customer.customerId;

    const customerLicense = await prisma.customerLicense.create({
      data: {
        customerId,
        licenseNumber: `TEST_LOTQTY_CUSTLIC_${Date.now()}`,
        licenseType: "Retail",
        issueDate: new Date(Date.now() - 100 * 86400000),
        expiryDate: new Date(Date.now() + 400 * 86400000),
        status: "ACTIVE",
      },
    });
    customerLicenseId = customerLicense.customerLicenseId;

    const inventoryStock = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_LOTQTY_LOT_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 10,
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
    await prisma.customerLicense.deleteMany({ where: { customerLicenseId } });
    await prisma.customer.deleteMany({ where: { customerId } });
    await prisma.product.deleteMany({ where: { productId } });
    await prisma.supplier.deleteMany({ where: { supplierId } });
    await prisma.category.deleteMany({ where: { categoryId } });
    await cleanupTestUsers();
  });

  it("rejects a sales order whose item quantity exceeds the lot's quantityOnHand", async () => {
    const orderNo = `TEST_LOTQTY_OVER_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 11, unitPrice: 10, discount: 0, inventoryStockId }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("insufficient");

    const persisted = await prisma.salesOrder.findUnique({ where: { orderNo } });
    expect(persisted).toBeNull();
  });

  it("accepts a sales order whose item quantity exactly matches the lot's quantityOnHand", async () => {
    const orderNo = `TEST_LOTQTY_EXACT_${Date.now()}`;
    const res = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 10, unitPrice: 10, discount: 0, inventoryStockId }],
      });

    expect(res.status).toBe(201);
    createdOrderNos.push(orderNo);
  });
});
