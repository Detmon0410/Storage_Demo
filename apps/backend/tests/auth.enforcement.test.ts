import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUser } from "./fixtures/testUser.js";

describe("GET route authentication enforcement", () => {
  afterAll(cleanupTestUsers);

  it("returns 401 for GET /api/categories with no Authorization header", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(401);
  });

  it("returns 401 for GET /api/products with no Authorization header", async () => {
    const res = await request(app).get("/api/products");
    expect(res.status).toBe(401);
  });

  it("returns 200 with an array for GET /api/categories with a valid access token", async () => {
    const { username, password } = await createTestUser("enforcement_get");
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    const accessToken = loginRes.body.accessToken;

    const res = await request(app).get("/api/categories").set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("still allows an unauthenticated POST /api/categories at this stage (write enforcement lands in plan 01-08)", async () => {
    const res = await request(app)
      .post("/api/categories")
      .send({ categoryCode: `TEST_ENFORCE_${Date.now()}`, categoryName: "Enforcement Test Category" });

    expect(res.status).not.toBe(401);
    expect(res.status).toBe(201);

    if (res.status === 201 && res.body?.id) {
      await prisma.category.delete({ where: { id: res.body.id } });
    }
  });
});
