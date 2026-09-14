import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";
import { RoleModel } from "../src/models/role.model.js";

describe("GET /api/auth/me", () => {
  afterAll(cleanupTestUsers);

  it("returns id, username, roles, and permissions for the authenticated user", async () => {
    const { user, username, password } = await createTestUserWithRoles("me_valid", [
      "SALES_OFFICER",
      "WAREHOUSE_DISTRIBUTION_OFFICER",
    ]);

    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    const { accessToken } = loginRes.body;

    const res = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${accessToken}`);

    const expectedPermissions = Array.from(await RoleModel.getUserPermissionCodes(user.id));
    const expectedRoles = await RoleModel.getUserRoleCodes(user.id);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(user.id);
    expect(res.body.username).toBe(username);
    expect(res.body.roles.sort()).toEqual(expectedRoles.sort());
    expect(res.body.permissions.sort()).toEqual(expectedPermissions.sort());
  });

  it("returns 401 when no Authorization header is present", async () => {
    const res = await request(app).get("/api/auth/me");

    expect(res.status).toBe(401);
  });
});
