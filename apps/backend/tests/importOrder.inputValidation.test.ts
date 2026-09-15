import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

describe("Import order input + status-transition validation (ENFORCE-05)", () => {
  let accessToken: string;
  let categoryId: number;
  let supplierId: number;
  let productId: number;
  const createdOrderNos: string[] = [];

  beforeAll(async () => {
    const { username, password } = await createTestUserWithRoles("importorder_inputvalidation", [
      "IMPORT_COMPLIANCE_OFFICER",
    ]);
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    accessToken = loginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { categoryCode: `TEST_IOIV_CAT_${Date.now()}`, categoryName: "Import Input Validation Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_IOIV_SUP_${Date.now()}`, supplierName: "Import Input Validation Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const product = await prisma.product.create({
      data: {
        productCode: `TEST_IOIV_PROD_${Date.now()}`,
        productName: "Import Input Validation Test Product",
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
    await prisma.stockTransaction.deleteMany({ where: { referenceNo: { in: createdOrderNos.map((n) => `IO:${n}`) } } });
    await prisma.inventoryStock.deleteMany({ where: { productId } });
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
    status: "STAGING",
    items: [{ productId, quantity: 10, unitPrice: 10 }],
    ...overrides,
  });

  it("rejects a negative item quantity with an error containing 'positive'", async () => {
    const orderNo = `TEST_IOIV_NEGQTY_${Date.now()}`;
    const res = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { items: [{ productId, quantity: -1, unitPrice: 10 }] }));

    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("positive");
  });

  it("rejects a negative item unitPrice with an error containing 'negative'", async () => {
    const orderNo = `TEST_IOIV_NEGPRICE_${Date.now()}`;
    const res = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { items: [{ productId, quantity: 10, unitPrice: -5 }] }));

    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("negative");
  });

  it("rejects an unknown status value with an error containing 'invalid status'", async () => {
    const orderNo = `TEST_IOIV_BOGUS_${Date.now()}`;
    const res = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { status: "BOGUS" }));

    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("invalid status");
  });

  it("rejects status APPROVED on create, even for a caller without approve permission", async () => {
    const orderNo = `TEST_IOIV_BYPASS_${Date.now()}`;
    const res = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { status: "APPROVED" }));

    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("dedicated approve/reject endpoint");
  });

  it("rejects status REJECTED on create", async () => {
    const orderNo = `TEST_IOIV_BYPASSREJ_${Date.now()}`;
    const res = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { status: "REJECTED" }));

    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("dedicated approve/reject endpoint");
  });

  it("rejects a backward status transition with an error containing 'invalid status transition'", async () => {
    const orderNo = `TEST_IOIV_BACKWARD_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { status: "CUSTOMS_CLEARED" }));
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);

    const putRes = await request(app)
      .put(`/api/import-orders/${createRes.body.importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "STAGING" });

    expect(putRes.status).toBe(400);
    expect(putRes.body.error.toLowerCase()).toContain("invalid status transition");
  });

  it("rejects any status change away from a terminal state with an error containing 'terminal state'", async () => {
    const orderNo = `TEST_IOIV_TERMINAL_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { status: "STAGING" }));
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);

    const issueRes = await request(app)
      .put(`/api/import-orders/${createRes.body.importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "ISSUE" });
    expect(issueRes.status).toBe(200);

    const putRes = await request(app)
      .put(`/api/import-orders/${createRes.body.importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "STAGING" });

    expect(putRes.status).toBe(400);
    expect(putRes.body.error.toLowerCase()).toContain("terminal state");
  });

  it("allows a legitimate forward status transition (positive control)", async () => {
    const orderNo = `TEST_IOIV_FORWARD_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { status: "STAGING" }));
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);

    const putRes = await request(app)
      .put(`/api/import-orders/${createRes.body.importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ status: "PENDING_APPROVAL" });

    expect(putRes.status).toBe(200);
    expect(putRes.body.status).toBe("PENDING_APPROVAL");
  });
});
