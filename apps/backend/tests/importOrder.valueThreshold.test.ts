import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";
import { IMPORT_ORDER_APPROVAL_THRESHOLD } from "../src/utils/importValueGate.js";

describe("Import order value-threshold approval gate (APPROVAL-05)", () => {
  let accessToken: string;
  let approverAccessToken: string;
  let categoryId: number;
  let supplierId: number;
  let productId: number;
  const createdOrderNos: string[] = [];

  // Over-threshold: a single line whose subtotal exceeds IMPORT_ORDER_APPROVAL_THRESHOLD.
  const overUnitPrice = IMPORT_ORDER_APPROVAL_THRESHOLD + 1000;
  const overQuantity = 1;

  // Under-threshold: a single line comfortably below IMPORT_ORDER_APPROVAL_THRESHOLD.
  const underUnitPrice = 10;
  const underQuantity = 1;

  beforeAll(async () => {
    const { username, password } = await createTestUserWithRoles("impval_officer", ["IMPORT_COMPLIANCE_OFFICER"]);
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    accessToken = loginRes.body.accessToken;

    const approver = await createTestUserWithRoles("impval_approver", ["MANAGER_APPROVER"]);
    const approverLoginRes = await request(app)
      .post("/api/auth/login")
      .send({ username: approver.username, password: approver.password });
    approverAccessToken = approverLoginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { categoryCode: `TEST_IMPVAL_CAT_${Date.now()}`, categoryName: "Import Value Threshold Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_IMPVAL_SUP_${Date.now()}`, supplierName: "Import Value Threshold Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const product = await prisma.product.create({
      data: {
        productCode: `TEST_IMPVAL_PROD_${Date.now()}`,
        productName: "Import Value Threshold Test Product",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 0,
        unitPrice: 10,
        status: "active",
      },
    });
    productId = product.productId;
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { entity: "ImportOrder" } });
    await prisma.stockTransaction.deleteMany({ where: { referenceNo: { in: createdOrderNos.map((n) => `IO:${n}`) } } });
    await prisma.inventoryStock.deleteMany({ where: { productId } });
    await prisma.importOrderItem.deleteMany({ where: { importOrder: { orderNo: { in: createdOrderNos } } } });
    await prisma.importOrder.deleteMany({ where: { orderNo: { in: createdOrderNos } } });
    await prisma.product.deleteMany({ where: { productId } });
    await prisma.supplier.deleteMany({ where: { supplierId } });
    await prisma.category.deleteMany({ where: { categoryId } });
    await cleanupTestUsers();
  });

  const baseOrder = (orderNo: string, overrides: Record<string, unknown> = {}) => ({
    orderNo,
    supplierId,
    country: "Scotland",
    incoterms: "FOB",
    orderDate: new Date().toISOString(),
    etaDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    logisticsStatus: "STAGING",
    items: [{ productId, quantity: underQuantity, unitPrice: underUnitPrice }],
    ...overrides,
  });

  it("creates an over-threshold order as PENDING_APPROVAL and does not create a stock lot even if logisticsStatus is RECEIVED", async () => {
    const orderNo = `TEST_IMPVAL_OVER_${Date.now()}`;
    const res = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        baseOrder(orderNo, {
          logisticsStatus: "RECEIVED",
          items: [{ productId, quantity: overQuantity, unitPrice: overUnitPrice }],
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PENDING_APPROVAL");
    createdOrderNos.push(orderNo);

    const lots = await prisma.inventoryStock.findMany({ where: { productId } });
    expect(lots.length).toBe(0);
  });

  it("allows a different IMPORT_ORDER_APPROVE holder to approve the pending order", async () => {
    const orderNo = `TEST_IMPVAL_APPROVE_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(
        baseOrder(orderNo, {
          items: [{ productId, quantity: overQuantity, unitPrice: overUnitPrice }],
        }),
      );
    expect(createRes.status).toBe(201);
    expect(createRes.body.status).toBe("PENDING_APPROVAL");
    createdOrderNos.push(orderNo);

    const approveRes = await request(app)
      .post(`/api/import-orders/${createRes.body.importOrderId}/approve`)
      .set("Authorization", `Bearer ${approverAccessToken}`)
      .send({});

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe("APPROVED");
    expect(approveRes.body.approvedById).not.toBeNull();
    expect(approveRes.body.approvedAt).not.toBeNull();
  });

  it("creates an under-threshold order as APPROVED immediately", async () => {
    const orderNo = `TEST_IMPVAL_UNDER_${Date.now()}`;
    const res = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo));

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("APPROVED");
    createdOrderNos.push(orderNo);
  });
});
