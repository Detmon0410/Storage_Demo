import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

async function loginAs(username: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ username, password });
  return res.body.accessToken as string;
}

describe("Order approve/reject *_APPROVE permission enforcement", () => {
  let categoryId: number;
  let supplierId: number;
  let importProductId: number;
  let salesProductId: number;
  let customerId: number;
  let customerLicenseId: number;
  let salesInventoryStockId: number;
  const createdImportOrderNos: string[] = [];
  const createdSalesOrderNos: string[] = [];

  const seed = async () => {
    const category = await prisma.category.create({
      data: { categoryCode: `TEST_RWO_CAT_${Date.now()}`, categoryName: "RBAC Writes Orders Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_RWO_SUP_${Date.now()}`, supplierName: "RBAC Writes Orders Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const importProduct = await prisma.product.create({
      data: {
        productCode: `TEST_RWO_PROD_IMP_${Date.now()}`,
        productName: "RBAC Writes Orders Test Product (import)",
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
        productCode: `TEST_RWO_PROD_SALE_${Date.now()}`,
        productName: "RBAC Writes Orders Test Product (sales)",
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
        customerCode: `TEST_RWO_CUST_${Date.now()}`,
        customerName: "RBAC Writes Orders Test Customer",
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
        licenseNumber: `TEST_RWO_CUSTLIC_${Date.now()}`,
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
        lotBatch: `TEST_RWO_LOT_${Date.now()}`,
        receivedDate: new Date(),
        quantityOnHand: 1000,
        stockAgeDays: 0,
        stockStatus: "AVAILABLE",
        warehouse: "MAIN",
      },
    });
    salesInventoryStockId = salesInventoryStock.inventoryStockId;
  };

  const teardown = async () => {
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
  };

  describe("ImportOrder approve", () => {
    beforeAll(seed);
    afterAll(teardown);

    it.each([
      { role: "SALES_OFFICER", expectDenied: true, label: "SALES_OFFICER denied (lacks IMPORT_ORDER_APPROVE)" },
      { role: "MANAGER_APPROVER", expectDenied: false, label: "MANAGER_APPROVER allowed" },
    ])("$label", async ({ role, expectDenied }) => {
      const creator = await createTestUserWithRoles("rwo_import_creator", ["IMPORT_COMPLIANCE_OFFICER"]);
      const actor = await createTestUserWithRoles(`rwo_import_actor_${role}`, [role]);
      const creatorToken = await loginAs(creator.username, creator.password);
      const actorToken = await loginAs(actor.username, actor.password);

      const orderNo = `TEST_RWO_IMP_${role}_${Date.now()}`;
      const createRes = await request(app)
        .post("/api/import-orders")
        .set("Authorization", `Bearer ${creatorToken}`)
        .send({
          orderNo,
          supplierId,
          country: "Scotland",
          incoterms: "FOB",
          orderDate: new Date().toISOString(),
          etaDate: new Date(Date.now() + 30 * 86400000).toISOString(),
          logisticsStatus: "STAGING",
          items: [{ productId: importProductId, quantity: 1, unitPrice: 10 }],
        });
      expect(createRes.status).toBe(201);
      createdImportOrderNos.push(orderNo);

      const approveRes = await request(app)
        .post(`/api/import-orders/${createRes.body.importOrderId}/approve`)
        .set("Authorization", `Bearer ${actorToken}`)
        .send({});

      if (expectDenied) {
        expect(approveRes.status).toBe(403);
      } else {
        expect(approveRes.status).not.toBe(403);
      }
    });
  });

  describe("SalesOrder approve", () => {
    beforeAll(seed);
    afterAll(teardown);

    it.each([
      { role: "IMPORT_COMPLIANCE_OFFICER", expectDenied: true, label: "IMPORT_COMPLIANCE_OFFICER denied (lacks SALES_ORDER_APPROVE)" },
      { role: "MANAGER_APPROVER", expectDenied: false, label: "MANAGER_APPROVER allowed" },
    ])("$label", async ({ role, expectDenied }) => {
      const creator = await createTestUserWithRoles("rwo_sales_creator", ["SALES_OFFICER"]);
      const actor = await createTestUserWithRoles(`rwo_sales_actor_${role}`, [role]);
      const creatorToken = await loginAs(creator.username, creator.password);
      const actorToken = await loginAs(actor.username, actor.password);

      const orderNo = `TEST_RWO_SALE_${role}_${Date.now()}`;
      const createRes = await request(app)
        .post("/api/sales-orders")
        .set("Authorization", `Bearer ${creatorToken}`)
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

      const approveRes = await request(app)
        .post(`/api/sales-orders/${createRes.body.salesOrderId}/approve`)
        .set("Authorization", `Bearer ${actorToken}`)
        .send({});

      if (expectDenied) {
        expect(approveRes.status).toBe(403);
      } else {
        expect(approveRes.status).not.toBe(403);
      }
    });
  });
});
