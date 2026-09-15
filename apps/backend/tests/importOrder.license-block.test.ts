import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

describe("Import order backend license-expiry blocking", () => {
  let accessToken: string;
  let categoryId: number;
  let supplierId: number;
  let expiredPermitProductId: number;
  let cleanProductId: number;
  const createdOrderNos: string[] = [];
  const createdLicenseIds: number[] = [];

  beforeAll(async () => {
    const { username, password } = await createTestUserWithRoles("importorder_license_block", ["IMPORT_COMPLIANCE_OFFICER"]);
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    accessToken = loginRes.body.accessToken;

    const category = await prisma.category.create({
      data: { categoryCode: `TEST_IOLB_CAT_${Date.now()}`, categoryName: "Import License Block Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `TEST_IOLB_SUP_${Date.now()}`, supplierName: "Import License Block Test Supplier", status: "ACTIVE" },
    });
    supplierId = supplier.supplierId;

    const expiredPermitProduct = await prisma.product.create({
      data: {
        productCode: `TEST_IOLB_PROD_EXP_${Date.now()}`,
        productName: "Import License Block Test Product (expired permit)",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 0,
        unitPrice: 10,
        status: "active",
      },
    });
    expiredPermitProductId = expiredPermitProduct.productId;

    const cleanProduct = await prisma.product.create({
      data: {
        productCode: `TEST_IOLB_PROD_OK_${Date.now()}`,
        productName: "Import License Block Test Product (no license)",
        categoryId,
        supplierId,
        unit: "bottle",
        stockQty: 0,
        unitPrice: 10,
        status: "active",
      },
    });
    cleanProductId = cleanProduct.productId;

    const expiredLicense = await prisma.license.create({
      data: {
        licenseNo: `TEST_IOLB_LIC_${Date.now()}`,
        licenseType: "Import",
        holderName: "Test Holder",
        category: "Test",
        issueDate: new Date(Date.now() - 400 * 86400000),
        expiryDate: new Date(Date.now() - 10 * 86400000),
        productId: expiredPermitProductId,
      },
    });
    createdLicenseIds.push(expiredLicense.licenseId);
  });

  afterAll(async () => {
    await prisma.importOrder.deleteMany({ where: { orderNo: { in: createdOrderNos } } });
    await prisma.license.deleteMany({ where: { licenseId: { in: createdLicenseIds } } });
    await prisma.stockTransaction.deleteMany({ where: { productId: { in: [expiredPermitProductId, cleanProductId] } } });
    await prisma.product.deleteMany({ where: { productId: { in: [expiredPermitProductId, cleanProductId] } } });
    await prisma.supplier.deleteMany({ where: { supplierId } });
    await prisma.category.deleteMany({ where: { categoryId } });
    await cleanupTestUsers();
  });

  it("returns 400 with a message mentioning 'expired permit' when creating an import order for an expired-permit product; no ImportOrder row is created", async () => {
    const orderNo = `TEST_IOLB_ORDER_${Date.now()}`;
    const res = await request(app)
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
        items: [{ productId: expiredPermitProductId, quantity: 10, unitPrice: 10 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.toLowerCase()).toContain("expired permit");

    const persisted = await prisma.importOrder.findUnique({ where: { orderNo } });
    expect(persisted).toBeNull();
  });

  it("returns 201 for an import order with a product that has no linked License", async () => {
    const orderNo = `TEST_IOLB_ORDER_OK_${Date.now()}`;
    const res = await request(app)
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
        items: [{ productId: cleanProductId, quantity: 10, unitPrice: 10 }],
      });

    expect(res.status).toBe(201);
    createdOrderNos.push(orderNo);
  });

  it("returns 400 on PUT when adding an expired-permit product line item to an existing import order", async () => {
    const orderNo = `TEST_IOLB_ORDER_UPD_${Date.now()}`;
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
        items: [{ productId: cleanProductId, quantity: 10, unitPrice: 10 }],
      });
    expect(createRes.status).toBe(201);
    createdOrderNos.push(orderNo);
    const importOrderId = createRes.body.importOrderId;

    const updateRes = await request(app)
      .put(`/api/import-orders/${importOrderId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        items: [
          { productId: cleanProductId, quantity: 10, unitPrice: 10 },
          { productId: expiredPermitProductId, quantity: 5, unitPrice: 10 },
        ],
      });

    expect(updateRes.status).toBe(400);
    expect(updateRes.body.error.toLowerCase()).toContain("expired permit");
  });
});
