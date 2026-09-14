import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

async function loginAs(username: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ username, password });
  return res.body.accessToken as string;
}

describe("GET /api/audit-logs — filterable, permission-gated, structurally immutable", () => {
  afterAll(cleanupTestUsers);

  it("returns 404 for PUT (no such route exists)", async () => {
    const { username, password } = await createTestUserWithRoles("audit_immutable_put", ["SYSTEM_ADMIN"]);
    const accessToken = await loginAs(username, password);

    const res = await request(app)
      .put("/api/audit-logs/1")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(404);
  });

  it("returns 404 for DELETE (no such route exists)", async () => {
    const { username, password } = await createTestUserWithRoles("audit_immutable_delete", ["SYSTEM_ADMIN"]);
    const accessToken = await loginAs(username, password);

    const res = await request(app)
      .delete("/api/audit-logs/1")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(404);
  });

  it("allows SYSTEM_ADMIN to GET /api/audit-logs with 200", async () => {
    const { username, password } = await createTestUserWithRoles("audit_immutable_admin", ["SYSTEM_ADMIN"]);
    const accessToken = await loginAs(username, password);

    const res = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("denies SALES_OFFICER GET /api/audit-logs with 403", async () => {
    const { username, password } = await createTestUserWithRoles("audit_immutable_sales", ["SALES_OFFICER"]);
    const accessToken = await loginAs(username, password);

    const res = await request(app).get("/api/audit-logs").set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });
});
