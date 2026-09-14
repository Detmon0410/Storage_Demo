import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUser } from "./fixtures/testUser.js";

async function authToken(suffix: string) {
  const { username, password } = await createTestUser(suffix);
  const loginRes = await request(app).post("/api/auth/login").send({ username, password });
  return loginRes.body.accessToken as string;
}

describe("Company profile endpoints", () => {
  afterAll(async () => {
    await cleanupTestUsers();
  });

  it("returns 401 for GET /api/companies with no Authorization header", async () => {
    const res = await request(app).get("/api/companies");
    expect(res.status).toBe(401);
  });

  it("returns 401 for PUT /api/companies with no Authorization header", async () => {
    const res = await request(app)
      .put("/api/companies")
      .send({ legalName: "Test Co", taxId: "T1", address: "1 Test St" });
    expect(res.status).toBe(401);
  });

  it("returns 400 when required fields are missing on PUT", async () => {
    const accessToken = await authToken("company_missing_fields");

    const res = await request(app)
      .put("/api/companies")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ legalName: "Only Name" });

    expect(res.status).toBe(400);
  });

  it("creates the singleton Company profile via PUT then reads it back via GET", async () => {
    const accessToken = await authToken("company_crud");
    const payload = { legalName: "Test Import Co., Ltd.", taxId: "T9999999999999", address: "123 Test Ave" };

    const putRes = await request(app)
      .put("/api/companies")
      .set("Authorization", `Bearer ${accessToken}`)
      .send(payload);

    expect(putRes.status).toBe(200);
    expect(putRes.body.legalName).toBe(payload.legalName);
    expect(putRes.body.taxId).toBe(payload.taxId);
    expect(putRes.body.address).toBe(payload.address);
    expect(putRes.body.companyId).toBe(1);

    const getRes = await request(app).get("/api/companies").set("Authorization", `Bearer ${accessToken}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.companyId).toBe(1);
    expect(getRes.body.legalName).toBe(payload.legalName);
  });

  it("upserts (updates) the same singleton row on a second PUT rather than creating a new row", async () => {
    const accessToken = await authToken("company_upsert");
    const auth = (req: request.Test) => req.set("Authorization", `Bearer ${accessToken}`);

    await auth(request(app).put("/api/companies")).send({
      legalName: "First Name Co.",
      taxId: "T1111111111111",
      address: "First Address",
    });

    const secondRes = await auth(request(app).put("/api/companies")).send({
      legalName: "Second Name Co.",
      taxId: "T2222222222222",
      address: "Second Address",
    });

    expect(secondRes.status).toBe(200);
    expect(secondRes.body.companyId).toBe(1);
    expect(secondRes.body.legalName).toBe("Second Name Co.");

    const count = await prisma.company.count();
    expect(count).toBe(1);
  });
});
