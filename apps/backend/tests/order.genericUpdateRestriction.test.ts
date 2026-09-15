import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

describe("Generic PUT restriction on order status (APPROVED/REJECTED bypass closed)", () => {
  let accessToken: string;
  let categoryId: number;
  let supplierId: number;
  let importProductId: number;
  let salesProductId: number;
  let customerId: number;
  let customerLicenseId: number;
  let salesInventoryStockId: number;
  const createdImportOrderNos: string[] = [];
  const createdSalesOrderNos: string[] = [];

  beforeAll(async () => {
    const { username, password } = await createTestUserWithRoles("order_generic_update_restriction", [
      "SYSTEM_ADMIN",
    ]);
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    accessToken = loginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { categoryCode: `TEST_GUR_CAT_${Date.now()}`, categoryName: "Generic Update Restriction Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_GUR_SUP_${Date.now()}`, supplierName: "Generic Update Restriction Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const importProduct = await prisma.product.create({
      data: {
        productCode: `TEST_GUR_PROD_IMP_${Date.now()}`,
        productName: "Generic Update Restriction Test Product (import)",
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
        productCode: `TEST_GUR_PROD_SALE_${Date.now()}`,
        productName: "Generic Update Restriction Test Product (sales)",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 1000,
        unitPrice: 10,
        status: "active",
      },
    });
    salesProductId = salesProduct.productId;

    const customer = await prisma.customer.create({
      data: {
        customerCode: `TEST_GUR_CUST_${Date.now()}`,
        customerName: "Generic Update Restriction Test Customer",
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
        licenseNumber: `TEST_GUR_CUSTLIC_${Date.now()}`,
        licenseType: "Retail",
        issueDate: new Date(Date.now() - 100 * 86400000),
        expiryDate: new Date(Date.now() + 400 * 86400000),
        status: "ACTIVE",
      },
    });
    customerLicenseId = customerLicense.customerLicenseId;

    const salesInventoryStock = await prisma.inventoryStock.create({
      data: {
        productId: salesProductId,
        lotBatch: `TEST_GUR_LOT_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 1000,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    salesInventoryStockId = salesInventoryStock.inventoryStockId;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entity: { in: ["ImportOrder", "SalesOrder"] } } });
    await prisma.stockTransaction.deleteMany({ where: { productId: { in: [importProductId, salesProductId] } } });
    await prisma.salesOrder.deleteMany({ where: { orderNo: { in: createdSalesOrderNos } } });
    await prisma.importOrder.deleteMany({ where: { orderNo: { in: createdImportOrderNos } } });
    await prisma.inventoryStock.deleteMany({ where: { inventoryStockId: salesInventoryStockId } });
    await prisma.customerLicense.deleteMany({ where: { customerLicenseId } });
    await prisma.customer.deleteMany({ where: { customerId } });
    await prisma.product.deleteMany({ where: { productId: { in: [importProductId, salesProductId] } } });
    await prisma.supplier.deleteMany({ where: { supplierId } });
    await prisma.category.deleteMany({ where: { categoryId } });
    await cleanupTestUsers();
  });

  it("PUT /api/import-orders/:id with status: APPROVED returns 400 with the guard's error message", async () => {
    const orderNo = `TEST_GUR_IMP_APPR_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        supplierId,
        country: "Scotland",
        incoterms: "FOB",
        orderDate: new Date().toISOString(),
        etaDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        status: "STAGING",
        items: [{ productId: importProductId, quantity: 1, unitPrice: 10 }],
      });
    expect(createRes.status).toBe(201);
    createdImportOrderNos.push(orderNo);

    const putRes = await request(app)
      .put(`/api/import-orders/${createRes.body.importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "APPROVED" });

    expect(putRes.status).toBe(400);
    expect(putRes.body.error).toContain("Use the dedicated approve/reject endpoint");
  });

  it("PUT /api/sales-orders/:id with deliveryStatus: REJECTED returns 400 with the guard's error message", async () => {
    const orderNo = `TEST_GUR_SALE_REJ_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId: salesProductId, quantity: 1, unitPrice: 10, discount: 0, inventoryStockId: salesInventoryStockId }],
      });
    expect(createRes.status).toBe(201);
    createdSalesOrderNos.push(orderNo);

    const putRes = await request(app)
      .put(`/api/sales-orders/${createRes.body.salesOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ deliveryStatus: "REJECTED" });

    expect(putRes.status).toBe(400);
    expect(putRes.body.error).toContain("Use the dedicated approve/reject endpoint");
  });

  it("PUT with any other status value still succeeds normally (restriction is narrowly scoped)", async () => {
    const orderNo = `TEST_GUR_IMP_OTHER_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        supplierId,
        country: "Scotland",
        incoterms: "FOB",
        orderDate: new Date().toISOString(),
        etaDate: new Date(Date.now() + 30 * 86400000).toISOString(),
        status: "STAGING",
        items: [{ productId: importProductId, quantity: 1, unitPrice: 10 }],
      });
    expect(createRes.status).toBe(201);
    createdImportOrderNos.push(orderNo);

    const putRes = await request(app)
      .put(`/api/import-orders/${createRes.body.importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "STAGING" });

    expect(putRes.status).toBe(200);
    expect(putRes.body.status).toBe("STAGING");
  });
});
