import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

describe("Import order ENFORCE-05 item/status validation", () => {
  let accessToken: string;
  let categoryId: number;
  let supplierId: number;
  let productId: number;
  const createdOrderNos: string[] = [];

  beforeAll(async () => {
    const { username, password } = await createTestUserWithRoles("importorder_enforce05", ["IMPORT_COMPLIANCE_OFFICER"]);
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    accessToken = loginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { categoryCode: `TEST_IOE5_CAT_${Date.now()}`, categoryName: "Import Enforce-05 Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_IOE5_SUP_${Date.now()}`, supplierName: "Import Enforce-05 Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const product = await prisma.product.create({
      data: {
        productCode: `TEST_IOE5_PROD_${Date.now()}`,
        productName: "Import Enforce-05 Test Product",
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
    logisticsStatus: "STAGING",
    items: [{ productId, quantity: 10, unitPrice: 10 }],
    ...overrides,
  });

  it("rejects negative quantity with a message containing 'positive'", async () => {
    const orderNo = `TEST_IOE5_NEGQTY_${Date.now()}`;
    const res = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { items: [{ productId, quantity: -1, unitPrice: 10 }] }));

    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("positive");
  });

  it("rejects negative unitPrice with a message containing 'negative'", async () => {
    const orderNo = `TEST_IOE5_NEGPRICE_${Date.now()}`;
    const res = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { items: [{ productId, quantity: 10, unitPrice: -5 }] }));

    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("negative");
  });

  it("accepts valid positive item values (201)", async () => {
    const orderNo = `TEST_IOE5_OK_${Date.now()}`;
    const res = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo));

    expect(res.status).toBe(201);
    createdOrderNos.push(orderNo);
  });

  it("rejects an unknown status value with a message containing 'invalid status'", async () => {
    const orderNo = `TEST_IOE5_BOGUS_${Date.now()}`;
    const res = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { logisticsStatus: "BOGUS" }));

    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("invalid logisticsstatus");
  });

  it("rejects a backward status transition with a message containing 'invalid status transition'", async () => {
    const orderNo = `TEST_IOE5_BACKWARD_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { logisticsStatus: "CUSTOMS_CLEARED" }));
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);

    const putRes = await request(app)
      .put(`/api/import-orders/${createRes.body.importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ logisticsStatus: "STAGING", items: [{ productId, quantity: 10, unitPrice: 10 }] });

    expect(putRes.status).toBe(400);
    expect(putRes.body.error.toLowerCase()).toContain("invalid logisticsstatus transition");
  });

  it("rejects any status change from a terminal state with a message containing 'terminal state'", async () => {
    const orderNo = `TEST_IOE5_TERMINAL_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { logisticsStatus: "ISSUE" }));
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);

    const putRes = await request(app)
      .put(`/api/import-orders/${createRes.body.importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ logisticsStatus: "CUSTOMS_CLEARED", items: [{ productId, quantity: 10, unitPrice: 10 }] });

    expect(putRes.status).toBe(400);
    expect(putRes.body.error.toLowerCase()).toContain("terminal state");
  });

  it("allows update with status omitted or equal to the existing value (no transition error)", async () => {
    const orderNo = `TEST_IOE5_NOOP_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/import-orders")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(baseOrder(orderNo, { logisticsStatus: "STAGING" }));
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);

    const putOmitted = await request(app)
      .put(`/api/import-orders/${createRes.body.importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ items: [{ productId, quantity: 12, unitPrice: 10 }] });
    expect(putOmitted.status).toBe(200);

    const putSame = await request(app)
      .put(`/api/import-orders/${createRes.body.importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ logisticsStatus: "STAGING", items: [{ productId, quantity: 12, unitPrice: 10 }] });
    expect(putSame.status).toBe(200);
  });
});
