import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

describe("ImportOrder and SalesOrder CRUD audit logging", () => {
  let accessToken: string;
  let categoryId: number;
  let supplierId: number;
  let importProductId: number;
  let salesProductId: number;
  let customerId: number;
  let customerLicenseId: number;
  const createdImportOrderNos: string[] = [];
  const createdSalesOrderNos: string[] = [];

  beforeAll(async () => {
    const { username, password } = await createTestUserWithRoles("audit_crud_orders", ["SYSTEM_ADMIN"]);
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    accessToken = loginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { categoryCode: `TEST_ACO_CAT_${Date.now()}`, categoryName: "Audit CRUD Orders Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_ACO_SUP_${Date.now()}`, supplierName: "Audit CRUD Orders Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const importProduct = await prisma.product.create({
      data: {
        productCode: `TEST_ACO_PROD_IMP_${Date.now()}`,
        productName: "Audit CRUD Orders Test Product (import)",
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
        productCode: `TEST_ACO_PROD_SALE_${Date.now()}`,
        productName: "Audit CRUD Orders Test Product (sales)",
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
        customerCode: `TEST_ACO_CUST_${Date.now()}`,
        customerName: "Audit CRUD Orders Test Customer",
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
        licenseNumber: `TEST_ACO_CUSTLIC_${Date.now()}`,
        licenseType: "Retail",
        issueDate: new Date(Date.now() - 100 * 86400000),
        expiryDate: new Date(Date.now() + 400 * 86400000),
        status: "ACTIVE",
      },
    });
    customerLicenseId = customerLicense.customerLicenseId;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({
      where: { entity: { in: ["ImportOrder", "SalesOrder"] } },
    });
    await prisma.stockTransaction.deleteMany({
      where: { productId: { in: [importProductId, salesProductId] } },
    });
    await prisma.salesOrder.deleteMany({ where: { orderNo: { in: createdSalesOrderNos } } });
    await prisma.importOrder.deleteMany({ where: { orderNo: { in: createdImportOrderNos } } });
    await prisma.customerLicense.deleteMany({ where: { customerLicenseId } });
    await prisma.customer.deleteMany({ where: { customerId } });
    await prisma.product.deleteMany({ where: { productId: { in: [importProductId, salesProductId] } } });
    await prisma.supplier.deleteMany({ where: { supplierId } });
    await prisma.category.deleteMany({ where: { categoryId } });
    await cleanupTestUsers();
  });

  it("create+update+delete on ImportOrder produces matching AuditLog rows and posts a linked IN stock transaction", async () => {
    const orderNo = `TEST_ACO_IMP_${Date.now()}`;
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
        status: "RECEIVED",
        items: [{ productId: importProductId, quantity: 5, unitPrice: 10 }],
      });
    expect(createRes.status).toBe(201);
    createdImportOrderNos.push(orderNo);
    const importOrderId = createRes.body.importOrderId;

    const stockTx = await prisma.stockTransaction.findMany({ where: { referenceNo: { contains: orderNo } } });
    expect(stockTx.length).toBeGreaterThan(0);
    expect(stockTx[0].transactionType).toBe("IN");

    const updateRes = await request(app)
      .put(`/api/import-orders/${importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ country: "Ireland" });
    expect(updateRes.status).toBe(200);

    const deleteRes = await request(app)
      .delete(`/api/import-orders/${importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleteRes.status).toBe(204);

    const createLogs = await prisma.auditLog.findMany({
      where: { entity: "ImportOrder", entityId: String(importOrderId), action: "create" },
    });
    const updateLogs = await prisma.auditLog.findMany({
      where: { entity: "ImportOrder", entityId: String(importOrderId), action: "update" },
    });
    const deleteLogs = await prisma.auditLog.findMany({
      where: { entity: "ImportOrder", entityId: String(importOrderId), action: "delete" },
    });

    expect(createLogs.length).toBe(1);
    expect(updateLogs.length).toBe(1);
    expect(deleteLogs.length).toBe(1);
    expect((updateLogs[0].before as { country: string }).country).toBe("Scotland");
    expect((updateLogs[0].after as { country: string }).country).toBe("Ireland");
  });

  it("create+update+delete on SalesOrder produces matching AuditLog rows and posts a linked OUT stock transaction", async () => {
    const orderNo = `TEST_ACO_SALE_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/sales-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        orderNo,
        customerId,
        customerLicenseId,
        deliveryStatus: "PENDING",
        invoiceNo: `INV-${orderNo}`,
        items: [{ productId: salesProductId, quantity: 2, unitPrice: 10, discount: 0, lotBatch: "LOT-1" }],
      });
    expect(createRes.status).toBe(201);
    createdSalesOrderNos.push(orderNo);
    const salesOrderId = createRes.body.salesOrderId;

    const stockTx = await prisma.stockTransaction.findMany({ where: { referenceNo: { contains: orderNo } } });
    expect(stockTx.length).toBeGreaterThan(0);
    expect(stockTx[0].transactionType).toBe("OUT");

    const updateRes = await request(app)
      .put(`/api/sales-orders/${salesOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ invoiceNo: `INV-UPDATED-${orderNo}` });
    expect(updateRes.status).toBe(200);

    const deleteRes = await request(app)
      .delete(`/api/sales-orders/${salesOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleteRes.status).toBe(204);

    const createLogs = await prisma.auditLog.findMany({
      where: { entity: "SalesOrder", entityId: String(salesOrderId), action: "create" },
    });
    const updateLogs = await prisma.auditLog.findMany({
      where: { entity: "SalesOrder", entityId: String(salesOrderId), action: "update" },
    });
    const deleteLogs = await prisma.auditLog.findMany({
      where: { entity: "SalesOrder", entityId: String(salesOrderId), action: "delete" },
    });

    expect(createLogs.length).toBe(1);
    expect(updateLogs.length).toBe(1);
    expect(deleteLogs.length).toBe(1);
    expect((updateLogs[0].before as { invoiceNo: string }).invoiceNo).toBe(`INV-${orderNo}`);
    expect((updateLogs[0].after as { invoiceNo: string }).invoiceNo).toBe(`INV-UPDATED-${orderNo}`);
  });

  it("createImportOrder sets createdById to the authenticated user", async () => {
    const orderNo = `TEST_ACO_IMP_CB_${Date.now()}`;
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

    const persisted = await prisma.importOrder.findUnique({ where: { orderNo } });
    expect(persisted!.createdById).not.toBeNull();
  });
});
