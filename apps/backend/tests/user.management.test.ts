import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { UserModel } from "../src/models/user.model.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

async function loginAs(username: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ username, password });
  return res.body.accessToken as string;
}

// The seeded database always has a real SYSTEM_ADMIN besides our test fixtures, so to exercise
// the "last active admin" guard we temporarily deactivate every OTHER active admin inside an
// interactive transaction that we force to roll back (by rejecting) once the assertion runs —
// this never permanently touches the seeded admin.
function withOnlyThisAdminActive<T>(excludingUserId: number, run: (tx: any) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { status: "ACTIVE", id: { not: excludingUserId }, userRoles: { some: { role: { roleCode: "SYSTEM_ADMIN" } } } },
      data: { status: "INACTIVE" },
    });
    return run(tx);
  });
}

describe("UserModel management", () => {
  afterAll(cleanupTestUsers);

  it("assignRoles replaces the role set rather than adding to it", async () => {
    const { user } = await createTestUserWithRoles("mgmt_assign", ["SALES_OFFICER"]);

    await UserModel.assignRoles(user.id, ["SALES_OFFICER", "WAREHOUSE_DISTRIBUTION_OFFICER"]);
    let withRoles = await UserModel.findByIdWithRoles(user.id);
    expect(withRoles?.userRoles.map((ur) => ur.role.roleCode).sort()).toEqual(
      ["SALES_OFFICER", "WAREHOUSE_DISTRIBUTION_OFFICER"].sort(),
    );

    await UserModel.assignRoles(user.id, ["FINANCE_ACCOUNTING_OFFICER"]);
    withRoles = await UserModel.findByIdWithRoles(user.id);
    expect(withRoles?.userRoles.map((ur) => ur.role.roleCode)).toEqual(["FINANCE_ACCOUNTING_OFFICER"]);
  });

  it("deactivate throws 409 when user is the only active SYSTEM_ADMIN", async () => {
    const { user } = await createTestUserWithRoles("mgmt_lastadmin_deactivate", ["SYSTEM_ADMIN"]);

    await expect(
      withOnlyThisAdminActive(user.id, (tx) => UserModel.deactivate(user.id, tx)),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("deactivate succeeds when another active SYSTEM_ADMIN exists", async () => {
    await createTestUserWithRoles("mgmt_otheradmin", ["SYSTEM_ADMIN"]);
    const { user } = await createTestUserWithRoles("mgmt_deactivatable", ["SYSTEM_ADMIN"]);

    const updated = await UserModel.deactivate(user.id);
    expect(updated.status).toBe("INACTIVE");
  });

  it("assignRoles throws 409 when removing SYSTEM_ADMIN from the last active admin", async () => {
    const { user } = await createTestUserWithRoles("mgmt_lastadmin_roles", ["SYSTEM_ADMIN"]);

    await expect(
      withOnlyThisAdminActive(user.id, (tx) => UserModel.assignRoles(user.id, ["SALES_OFFICER"], tx)),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("reactivate sets status back to ACTIVE", async () => {
    await createTestUserWithRoles("mgmt_otheradmin2", ["SYSTEM_ADMIN"]);
    const { user } = await createTestUserWithRoles("mgmt_reactivate", ["SALES_OFFICER"]);
    await UserModel.deactivate(user.id);

    const reactivated = await UserModel.reactivate(user.id);
    expect(reactivated.status).toBe("ACTIVE");
  });

  it("findByIdWithRoles returns flattened role codes matching assignRoles input", async () => {
    const { user } = await createTestUserWithRoles("mgmt_findbyid", ["SALES_OFFICER", "FINANCE_ACCOUNTING_OFFICER"]);

    await UserModel.assignRoles(user.id, ["SALES_OFFICER"]);
    const withRoles = await UserModel.findByIdWithRoles(user.id);
    expect(withRoles?.userRoles.map((ur) => ur.role.roleCode)).toEqual(["SALES_OFFICER"]);
  });
});

describe("User management HTTP routes", () => {
  afterAll(cleanupTestUsers);

  // Shared across every test below to keep total /api/auth/login calls in this file under the
  // 10-per-window rate limit (each test previously created + logged in its own admin, which
  // adds up fast once combined with the it.each non-admin-denial logins further down).
  let adminToken: string;
  beforeAll(async () => {
    const { username: adminUsername, password: adminPassword } = await createTestUserWithRoles("http_shared_admin", ["SYSTEM_ADMIN"]);
    adminToken = await loginAs(adminUsername, adminPassword);
  });

  it("SYSTEM_ADMIN can create -> assign roles -> deactivate -> reactivate a user end-to-end", async () => {
    const newUsername = `test_http_created_${Date.now()}`;
    const createRes = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: newUsername, password: "TestPass123", roleCodes: ["SALES_OFFICER", "WAREHOUSE_DISTRIBUTION_OFFICER"] });
    expect(createRes.status).toBe(201);
    expect(createRes.body.roles.sort()).toEqual(["SALES_OFFICER", "WAREHOUSE_DISTRIBUTION_OFFICER"].sort());
    expect(createRes.body.passwordHash).toBeUndefined();
    const createdId = createRes.body.id as number;

    const getRes = await request(app).get(`/api/users/${createdId}`).set("Authorization", `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.roles.sort()).toEqual(["SALES_OFFICER", "WAREHOUSE_DISTRIBUTION_OFFICER"].sort());

    const deactivateRes = await request(app)
      .post(`/api/users/${createdId}/deactivate`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(deactivateRes.status).toBe(200);
    const afterDeactivate = await request(app).get(`/api/users/${createdId}`).set("Authorization", `Bearer ${adminToken}`);
    expect(afterDeactivate.body.status).toBe("INACTIVE");

    const reactivateRes = await request(app)
      .post(`/api/users/${createdId}/reactivate`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(reactivateRes.status).toBe(200);
    const afterReactivate = await request(app).get(`/api/users/${createdId}`).set("Authorization", `Bearer ${adminToken}`);
    expect(afterReactivate.body.status).toBe("ACTIVE");
  });

  it("listUsers response includes role codes for each user, not just id/username/status", async () => {
    await createTestUserWithRoles("http_list_target", ["SALES_OFFICER"]);

    const res = await request(app).get("/api/users").set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const target = res.body.find((u: { username: string }) => u.username.startsWith("test_http_list_target_"));
    expect(target?.roles).toEqual(["SALES_OFFICER"]);
  });

  it("SYSTEM_ADMIN can reset a user's password and the user can log in with the new password", async () => {
    const { user, username: targetUsername } = await createTestUserWithRoles("http_pwreset_target", ["SALES_OFFICER"]);

    const resetRes = await request(app)
      .put(`/api/users/${user.id}/password`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ password: "BrandNewPass123" });
    expect(resetRes.status).toBe(204);

    const newToken = await loginAs(targetUsername, "BrandNewPass123");
    expect(newToken).toBeTruthy();
  });

  it("rejects password reset with a password shorter than 8 characters with 400", async () => {
    const { user } = await createTestUserWithRoles("http_pwreset_short_target", ["SALES_OFFICER"]);

    const res = await request(app)
      .put(`/api/users/${user.id}/password`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ password: "short" });
    expect(res.status).toBe(400);
  });

  it("rejects createUser roleCodes containing an unknown role code with 400", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ username: `test_http_badrole_${Date.now()}`, password: "TestPass123", roleCodes: ["NOT_A_REAL_ROLE"] });
    expect(res.status).toBe(400);
  });

  const nonAdminCases = [
    { name: "GET /api/users", method: "get" as const, path: () => "/api/users", body: undefined },
    { name: "GET /api/users/:id", method: "get" as const, path: () => "/api/users/1", body: undefined },
    { name: "POST /api/users", method: "post" as const, path: () => "/api/users", body: { username: "x", password: "TestPass123", roleCodes: ["SALES_OFFICER"] } },
    { name: "PUT /api/users/:id", method: "put" as const, path: () => "/api/users/1", body: { username: "x" } },
    { name: "POST /api/users/:id/deactivate", method: "post" as const, path: () => "/api/users/1/deactivate", body: undefined },
    { name: "POST /api/users/:id/reactivate", method: "post" as const, path: () => "/api/users/1/reactivate", body: undefined },
    { name: "PUT /api/users/:id/roles", method: "put" as const, path: () => "/api/users/1/roles", body: { roleCodes: ["SALES_OFFICER"] } },
    { name: "PUT /api/users/:id/password", method: "put" as const, path: () => "/api/users/1/password", body: { password: "NewPass123" } },
  ] as const;

  it.each(nonAdminCases)("$name is denied with 403 for a non-admin (SALES_OFFICER)", async (testCase) => {
    const { username, password } = await createTestUserWithRoles(
      `http_nonadmin_${testCase.name.replace(/[^a-zA-Z]/g, "_")}`,
      ["SALES_OFFICER"],
    );
    const token = await loginAs(username, password);

    const req = request(app)[testCase.method](testCase.path()).set("Authorization", `Bearer ${token}`);
    const res = testCase.body ? await req.send(testCase.body) : await req;

    expect(res.status).toBe(403);
  });
});
