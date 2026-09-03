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

  it("returns 401 for POST /api/categories with no Authorization header", async () => {
    const res = await request(app)
      .post("/api/categories")
      .send({ categoryCode: `TEST_ENFORCE_${Date.now()}`, categoryName: "Enforcement Test Category" });

    expect(res.status).toBe(401);
  });

  it("returns 401 for PUT /api/categories/:id with no Authorization header", async () => {
    const res = await request(app)
      .put("/api/categories/1")
      .send({ categoryName: "Enforcement Test Category Updated" });

    expect(res.status).toBe(401);
  });

  it("still allows an authenticated POST /api/categories to succeed", async () => {
    const { username, password } = await createTestUser("enforcement_post");
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    const accessToken = loginRes.body.accessToken;

    const res = await request(app)
      .post("/api/categories")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ categoryCode: `TEST_ENFORCE_${Date.now()}`, categoryName: "Enforcement Test Category" });

    expect(res.status).toBe(201);

    if (res.status === 201 && res.body?.id) {
      await prisma.category.delete({ where: { id: res.body.id } });
    }
  });

  it("still allows an unauthenticated DELETE /api/categories/:id at this stage (destructive enforcement lands in plan 01-09)", async () => {
    const res = await request(app).delete("/api/categories/999999");

    expect(res.status).not.toBe(401);
  });
});
