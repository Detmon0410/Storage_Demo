import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUser } from "./fixtures/testUser.js";

async function authToken(suffix: string) {
  const { username, password } = await createTestUser(suffix);
  const loginRes = await request(app).post("/api/auth/login").send({ username, password });
  return loginRes.body.accessToken as string;
}

function isoDaysFromNow(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

describe("License endpoints", () => {
  const createdLicenseIds: number[] = [];
  let companyId: number;
  let productId: number;
  let categoryId: number;
  let supplierId: number;

  beforeAll(async () => {
    // Defensive cleanup: remove any stray rows left behind by a previously
    // interrupted run of this test file (e.g. a crashed process that skipped
    // afterAll), so the singleton-count assertions in company.test.ts stay accurate.
    await prisma.license.deleteMany({ where: { licenseNo: { startsWith: "LIC-TEST-" } } });
    await prisma.product.deleteMany({ where: { productCode: { startsWith: "LIC_TEST_PROD_" } } });
    await prisma.category.deleteMany({ where: { categoryCode: { startsWith: "LIC_TEST_CAT_" } } });
    await prisma.supplier.deleteMany({ where: { supplierCode: { startsWith: "LIC_TEST_SUP_" } } });
    await prisma.company.deleteMany({ where: { taxId: { startsWith: "T-LIC-TEST-" } } });

    const company = await prisma.company.create({
      data: {
        legalName: "License Test Co., Ltd.",
        taxId: `T-LIC-TEST-${Date.now()}`,
        address: "1 License Test St.",
      },
    });
    companyId = company.companyId;

    const category = await prisma.category.create({
      data: { categoryCode: `LIC_TEST_CAT_${Date.now()}`, categoryName: "License Test Category" },
    });
    categoryId = category.categoryId;

    const supplier = await prisma.supplier.create({
      data: { supplierCode: `LIC_TEST_SUP_${Date.now()}`, supplierName: "License Test Supplier" },
    });
    supplierId = supplier.supplierId;

    const product = await prisma.product.create({
      data: {
        productCode: `LIC_TEST_PROD_${Date.now()}`,
        productName: "License Test Product",
        categoryId,
        supplierId,
        unit: "case",
        unitPrice: 100,
      },
    });
    productId = product.productId;
  });

  afterAll(async () => {
    if (createdLicenseIds.length > 0) {
      await prisma.license.deleteMany({ where: { licenseId: { in: createdLicenseIds } } });
    }
    if (productId) await prisma.product.delete({ where: { productId } });
    if (categoryId) await prisma.category.delete({ where: { categoryId } });
    if (supplierId) await prisma.supplier.delete({ where: { supplierId } });
    if (companyId) await prisma.company.delete({ where: { companyId } });
    await cleanupTestUsers();
  });

  it("creates a license with no companyId/productId and returns null for both", async () => {
    const accessToken = await authToken("license_no_links");

    const res = await request(app)
      .post("/api/licenses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        licenseNo: `LIC-TEST-NOLINK-${Date.now()}`,
        licenseType: "Test License Type",
        holderName: "Test Holder",
        category: "IMPORT",
        issueDate: "2026-01-01",
        expiryDate: isoDaysFromNow(400),
      });

    expect(res.status).toBe(201);
    expect(res.body.companyId).toBeNull();
    expect(res.body.productId).toBeNull();
    createdLicenseIds.push(res.body.licenseId);
  });

  it("creates a license with companyId/productId set and returns populated company/product", async () => {
    const accessToken = await authToken("license_with_links");

    const res = await request(app)
      .post("/api/licenses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        licenseNo: `LIC-TEST-LINKED-${Date.now()}`,
        licenseType: "Test License Type",
        holderName: "Test Holder",
        category: "IMPORT",
        issueDate: "2026-01-01",
        expiryDate: isoDaysFromNow(400),
        companyId,
        productId,
      });

    expect(res.status).toBe(201);
    expect(res.body.companyId).toBe(companyId);
    expect(res.body.productId).toBe(productId);
    expect(res.body.company).toBeTruthy();
    expect(res.body.company.companyId).toBe(companyId);
    expect(res.body.product).toBeTruthy();
    expect(res.body.product.productId).toBe(productId);
    createdLicenseIds.push(res.body.licenseId);
  });

  it("ignores attacker-supplied daysRemaining/status and computes status from expiryDate instead", async () => {
    const accessToken = await authToken("license_fake_status");

    const res = await request(app)
      .post("/api/licenses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        licenseNo: `LIC-TEST-FAKESTATUS-${Date.now()}`,
        licenseType: "Test License Type",
        holderName: "Test Holder",
        category: "IMPORT",
        issueDate: "2020-01-01",
        expiryDate: isoDaysFromNow(-10),
        daysRemaining: -999,
        status: "NORMAL",
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("EXPIRED");
    expect(res.body.status).not.toBe("NORMAL");
    createdLicenseIds.push(res.body.licenseId);
  });

  it("returns NORMAL status and ~400 daysRemaining for a license expiring 400 days in the future", async () => {
    const accessToken = await authToken("license_future");

    const createRes = await request(app)
      .post("/api/licenses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        licenseNo: `LIC-TEST-FUTURE-${Date.now()}`,
        licenseType: "Test License Type",
        holderName: "Test Holder",
        category: "IMPORT",
        issueDate: "2026-01-01",
        expiryDate: isoDaysFromNow(400),
      });
    createdLicenseIds.push(createRes.body.licenseId);

    const res = await request(app)
      .get(`/api/licenses/${createRes.body.licenseId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("NORMAL");
    expect(res.body.daysRemaining).toBeGreaterThanOrEqual(398);
    expect(res.body.daysRemaining).toBeLessThanOrEqual(401);
  });

  it("returns EXPIRED status for a license that expired 10 days ago", async () => {
    const accessToken = await authToken("license_expired");

    const createRes = await request(app)
      .post("/api/licenses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        licenseNo: `LIC-TEST-EXPIRED-${Date.now()}`,
        licenseType: "Test License Type",
        holderName: "Test Holder",
        category: "IMPORT",
        issueDate: "2020-01-01",
        expiryDate: isoDaysFromNow(-10),
      });
    createdLicenseIds.push(createRes.body.licenseId);

    const res = await request(app)
      .get(`/api/licenses/${createRes.body.licenseId}`)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("EXPIRED");
  });

  it("allows PUT updating only companyId, without requiring daysRemaining/status, and still returns a computed status", async () => {
    const accessToken = await authToken("license_update_company");

    const createRes = await request(app)
      .post("/api/licenses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        licenseNo: `LIC-TEST-UPDATE-${Date.now()}`,
        licenseType: "Test License Type",
        holderName: "Test Holder",
        category: "IMPORT",
        issueDate: "2026-01-01",
        expiryDate: isoDaysFromNow(400),
      });
    createdLicenseIds.push(createRes.body.licenseId);

    const res = await request(app)
      .put(`/api/licenses/${createRes.body.licenseId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ companyId });

    expect(res.status).toBe(200);
    expect(res.body.companyId).toBe(companyId);
    expect(res.body.status).toBe("NORMAL");
  });

  it("returns existing licenses with companyId/productId null without error via GET /api/licenses", async () => {
    const accessToken = await authToken("license_list_unlinked");

    const createRes = await request(app)
      .post("/api/licenses")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        licenseNo: `LIC-TEST-UNLINKED-${Date.now()}`,
        licenseType: "Test License Type",
        holderName: "Test Holder",
        category: "IMPORT",
        issueDate: "2026-01-01",
        expiryDate: isoDaysFromNow(400),
      });
    createdLicenseIds.push(createRes.body.licenseId);

    const res = await request(app).get("/api/licenses").set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((l: { licenseId: number }) => l.licenseId === createRes.body.licenseId);
    expect(found).toBeTruthy();
    expect(found.companyId).toBeNull();
    expect(found.productId).toBeNull();
  });
});
