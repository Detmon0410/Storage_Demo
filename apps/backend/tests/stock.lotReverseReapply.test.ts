import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

describe("Sales order lot reverse-then-reapply on update/delete (STOCK-03)", () => {
  let accessToken: string;
  let adminAccessToken: string;
  let categoryId: number;
  let supplierId: number;
  let productId: number;
  let customerId: number;
  let customerLicenseId: number;
  const createdOrderNos: string[] = [];
  const createdInventoryStockIds: number[] = [];

  beforeAll(async () => {
    const { username, password } = await createTestUserWithRoles("stock_lotreverse", ["SALES_OFFICER"]);
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    accessToken = loginRes.body.accessToken;

    const admin = await createTestUserWithRoles("stock_lotreverse_admin", ["SYSTEM_ADMIN"]);
    const adminLoginRes = await request(app).post("/api/auth/login").send({ username: admin.username, password: admin.password });
    adminAccessToken = adminLoginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { categoryCode: `TEST_LOTREV_CAT_${Date.now()}`, categoryName: "Lot Reverse Reapply Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_LOTREV_SUP_${Date.now()}`, supplierName: "Lot Reverse Reapply Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const product = await prisma.product.create({
      data: {
        productCode: `TEST_LOTREV_PROD_${Date.now()}`,
        productName: "Lot Reverse Reapply Test Product",
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
        customerCode: `TEST_LOTREV_CUST_${Date.now()}`,
        customerName: "Lot Reverse Reapply Test Customer",
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
        licenseNumber: `TEST_LOTREV_CUSTLIC_${Date.now()}`,
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

  it("restores the original decrement before applying the new one on update (not a naive double-subtract)", async () => {
    const inventoryStock = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_LOTREV_LOT_UPD_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 50,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    createdInventoryStockIds.push(inventoryStock.inventoryStockId);
    const inventoryStockId = inventoryStock.inventoryStockId;

    const orderNo = `TEST_LOTREV_UPD_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 20, unitPrice: 10, discount: 0, inventoryStockId }],
      });
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);
    const salesOrderId = createRes.body.salesOrderId;

    const afterCreateLot = await prisma.inventoryStock.findUnique({ where: { inventoryStockId } });
    expect(afterCreateLot?.quantityOnHand).toBe(30);

    const updateRes = await request(app)
      .put(`/api/sales-orders/${salesOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        items: [{ productId, quantity: 5, unitPrice: 10, discount: 0, inventoryStockId }],
      });
    expect(updateRes.status).toBe(200);

    const afterUpdateLot = await prisma.inventoryStock.findUnique({ where: { inventoryStockId } });
    expect(afterUpdateLot?.quantityOnHand).toBe(45);
  });

  it("restores the lot's quantityOnHand fully when the order is deleted", async () => {
    const inventoryStock = await prisma.inventoryStock.create({
      data: {
        productId,
        lotBatch: `TEST_LOTREV_LOT_DEL_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 50,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    createdInventoryStockIds.push(inventoryStock.inventoryStockId);
    const inventoryStockId = inventoryStock.inventoryStockId;

    const orderNo = `TEST_LOTREV_DEL_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId, quantity: 15, unitPrice: 10, discount: 0, inventoryStockId }],
      });
    expect(createRes.status).toBe(201);
    const salesOrderId = createRes.body.salesOrderId;

    const afterCreateLot = await prisma.inventoryStock.findUnique({ where: { inventoryStockId } });
    expect(afterCreateLot?.quantityOnHand).toBe(35);

    const deleteRes = await request(app)
      .delete(`/api/sales-orders/${salesOrderId}`)
      .set("Authorization", `Bearer ${adminAccessToken}`);
    expect(deleteRes.status).toBe(204);

    const afterDeleteLot = await prisma.inventoryStock.findUnique({ where: { inventoryStockId } });
    expect(afterDeleteLot?.quantityOnHand).toBe(50);
  });
});
