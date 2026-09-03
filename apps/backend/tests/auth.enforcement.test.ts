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

  it("returns 401 for DELETE /api/categories/:id with no Authorization header", async () => {
    const res = await request(app).delete("/api/categories/999999");

    expect(res.status).toBe(401);
  });

  it("allows a full authenticated CRUD round-trip on /api/categories (create -> read -> update -> delete)", async () => {
    const { username, password } = await createTestUser("enforcement_crud");
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    const accessToken = loginRes.body.accessToken;
    const auth = (req: request.Test) => req.set("Authorization", `Bearer ${accessToken}`);

    const createRes = await auth(request(app).post("/api/categories")).send({
      categoryCode: `TEST_CRUD_${Date.now()}`,
      categoryName: "CRUD Round-trip Category",
    });
    expect(createRes.status).toBe(201);
    const categoryId = createRes.body.categoryId;

    const readRes = await auth(request(app).get(`/api/categories/${categoryId}`));
    expect(readRes.status).toBe(200);
    expect(readRes.body.categoryId).toBe(categoryId);

    const updateRes = await auth(request(app).put(`/api/categories/${categoryId}`)).send({
      categoryName: "CRUD Round-trip Category Updated",
    });
    expect(updateRes.status).toBe(200);

    const deleteRes = await auth(request(app).delete(`/api/categories/${categoryId}`));
    expect(deleteRes.status).toBe(204);
  });
});
