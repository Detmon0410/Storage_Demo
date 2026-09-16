import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

async function loginAs(username: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ username, password });
  return res.body.accessToken as string;
}

describe("Order approve/reject no-self-approval enforcement", () => {
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
    const category = await prisma.category.create({
      data: { categoryCode: `TEST_NSA_CAT_${Date.now()}`, categoryName: "No Self Approval Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_NSA_SUP_${Date.now()}`, supplierName: "No Self Approval Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const importProduct = await prisma.product.create({
      data: {
        productCode: `TEST_NSA_PROD_IMP_${Date.now()}`,
        productName: "No Self Approval Test Product (import)",
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
        productCode: `TEST_NSA_PROD_SALE_${Date.now()}`,
        productName: "No Self Approval Test Product (sales)",
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
        customerCode: `TEST_NSA_CUST_${Date.now()}`,
        customerName: "No Self Approval Test Customer",
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
        licenseNumber: `TEST_NSA_CUSTLIC_${Date.now()}`,
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
        lotBatch: `TEST_NSA_LOT_${Date.now()}`,
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

  it("rejects the creator's own ImportOrder approve attempt with 403, but allows a different IMPORT_ORDER_APPROVE holder to approve it (200, status APPROVED)", async () => {
    const creator = await createTestUserWithRoles("nsa_import_creator", ["IMPORT_COMPLIANCE_OFFICER"]);
    const approver = await createTestUserWithRoles("nsa_import_approver", ["SYSTEM_ADMIN"]);
    const creatorToken = await loginAs(creator.username, creator.password);
    const approverToken = await loginAs(approver.username, approver.password);

    const orderNo = `TEST_NSA_IMP_${Date.now()}`;
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
    const importOrderId = createRes.body.importOrderId;

    const selfApproveRes = await request(app)
      .post(`/api/import-orders/${importOrderId}/approve`)
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({});
    expect(selfApproveRes.status).toBe(403);

    const approveRes = await request(app)
      .post(`/api/import-orders/${importOrderId}/approve`)
      .set("Authorization", `Bearer ${approverToken}`)
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("APPROVED");
    expect(approveRes.body.approvedById).toBe(approver.user.id);
    expect(approveRes.body.approvedAt).not.toBeNull();
  });

  it("rejects the creator's own SalesOrder approve attempt with 403, but allows a different SALES_ORDER_APPROVE holder to approve it (200, deliveryStatus APPROVED)", async () => {
    const creator = await createTestUserWithRoles("nsa_sales_creator", ["SALES_OFFICER"]);
    const approver = await createTestUserWithRoles("nsa_sales_approver", ["SYSTEM_ADMIN"]);
    const creatorToken = await loginAs(creator.username, creator.password);
    const approverToken = await loginAs(approver.username, approver.password);

    const orderNo = `TEST_NSA_SALE_${Date.now()}`;
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
    const salesOrderId = createRes.body.salesOrderId;

    const selfApproveRes = await request(app)
      .post(`/api/sales-orders/${salesOrderId}/approve`)
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({});
    expect(selfApproveRes.status).toBe(403);

    const approveRes = await request(app)
      .post(`/api/sales-orders/${salesOrderId}/approve`)
      .set("Authorization", `Bearer ${approverToken}`)
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("APPROVED");
    expect(approveRes.body.approvedById).toBe(approver.user.id);
    expect(approveRes.body.approvedAt).not.toBeNull();
  });

  it("rejects the creator's own SalesOrder reject attempt with 403, but allows a different approve-holder to reject it (200, deliveryStatus REJECTED)", async () => {
    const creator = await createTestUserWithRoles("nsa_sales_reject_creator", ["SALES_OFFICER"]);
    const approver = await createTestUserWithRoles("nsa_sales_reject_approver", ["SYSTEM_ADMIN"]);
    const creatorToken = await loginAs(creator.username, creator.password);
    const approverToken = await loginAs(approver.username, approver.password);

    const orderNo = `TEST_NSA_SALE_REJ_${Date.now()}`;
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
    const salesOrderId = createRes.body.salesOrderId;

    const selfRejectRes = await request(app)
      .post(`/api/sales-orders/${salesOrderId}/reject`)
      .set("Authorization", `Bearer ${creatorToken}`)
      .send({ reason: "self-reject attempt" });
    expect(selfRejectRes.status).toBe(403);

    const rejectRes = await request(app)
      .post(`/api/sales-orders/${salesOrderId}/reject`)
      .set("Authorization", `Bearer ${approverToken}`)
      .send({ reason: "not compliant" });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.status).toBe("REJECTED");
    expect(rejectRes.body.rejectionReason).toBe("not compliant");
  });

  it("allows approval of an order with createdById: null (historical data) by anyone holding IMPORT_ORDER_APPROVE", async () => {
    const approver = await createTestUserWithRoles("nsa_null_creator_approver", ["SYSTEM_ADMIN"]);
    const approverToken = await loginAs(approver.username, approver.password);

    const orderNo = `TEST_NSA_NULLCREATOR_${Date.now()}`;
    // Insert directly via Prisma to simulate seeded historical data with createdById: null.
    const order = await prisma.importOrder.create({
      data: {
        orderNo,
        supplierId,
        country: "Scotland",
        incoterms: "FOB",
        orderDate: new Date(),
        etaDate: new Date(Date.now() + 30 * 86400000),
        logisticsStatus: "STAGING",
        skuItemCount: 1,
        totalValue: 10,
        createdById: null,
        items: { create: [{ productId: importProductId, quantity: 1, unitPrice: 10, subtotal: 10 }] },
      },
    });
    createdImportOrderNos.push(orderNo);

    const approveRes = await request(app)
      .post(`/api/import-orders/${order.importOrderId}/approve`)
      .set("Authorization", `Bearer ${approverToken}`)
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("APPROVED");
    expect(approveRes.body.approvedById).toBe(approver.user.id);
    expect(approveRes.body.approvedAt).not.toBeNull();
  });

  it("rejects the last editor's (updatedById) own SalesOrder approve attempt with 403 mentioning 'last edited', but allows a third-party approver to approve it (200)", async () => {
    const creator = await createTestUserWithRoles("nsa_sales_edit_creator", ["SALES_OFFICER"]);
    const editor = await createTestUserWithRoles("nsa_sales_edit_editor", ["SALES_OFFICER", "MANAGER_APPROVER"]);
    const finalApprover = await createTestUserWithRoles("nsa_sales_edit_approver", ["MANAGER_APPROVER"]);
    const creatorToken = await loginAs(creator.username, creator.password);
    const editorToken = await loginAs(editor.username, editor.password);
    const finalApproverToken = await loginAs(finalApprover.username, finalApprover.password);

    const orderNo = `TEST_NSA_SALE_EDIT_${Date.now()}`;
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
    const salesOrderId = createRes.body.salesOrderId;

    const editRes = await request(app)
      .put(`/api/sales-orders/${salesOrderId}`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send({ invoiceNo: `INV-${orderNo}-EDITED` });
    expect(editRes.status).toBe(200);

    const editorApproveRes = await request(app)
      .post(`/api/sales-orders/${salesOrderId}/approve`)
      .set("Authorization", `Bearer ${editorToken}`)
      .send({});
    expect(editorApproveRes.status).toBe(403);
    expect(editorApproveRes.body.error.toLowerCase()).toContain("last edited");

    const approveRes = await request(app)
      .post(`/api/sales-orders/${salesOrderId}/approve`)
      .set("Authorization", `Bearer ${finalApproverToken}`)
      .send({});
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("APPROVED");
  });
});
