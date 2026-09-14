import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

describe("Role revocation reflects on the very next request without re-login", () => {
  afterAll(cleanupTestUsers);

  it("denies, then allows after role grant, then denies again after role revocation - same token throughout", async () => {
    const { user, username, password } = await createTestUserWithRoles("revocation", ["SALES_OFFICER"]);

    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    const accessToken = loginRes.body.accessToken;
    const auth = (req: request.Test) => req.set("Authorization", `Bearer ${accessToken}`);

    const payload = { categoryCode: `TEST_REVOKE_${Date.now()}`, categoryName: "Revocation Test Category" };

    const deniedRes = await auth(request(app).post("/api/categories")).send(payload);
    expect(deniedRes.status).toBe(403);

    const systemAdminRole = await prisma.role.findUniqueOrThrow({ where: { roleCode: "SYSTEM_ADMIN" } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: systemAdminRole.roleId } });

    const allowedRes = await auth(request(app).post("/api/categories")).send(payload);
    expect(allowedRes.status).toBe(201);
    if (allowedRes.status === 201 && allowedRes.body?.categoryId) {
      await prisma.category.delete({ where: { categoryId: allowedRes.body.categoryId } });
    }

    await prisma.userRole.delete({
      where: { userId_roleId: { userId: user.id, roleId: systemAdminRole.roleId } },
    });

    const deniedAgainRes = await auth(request(app).post("/api/categories")).send(payload);
    expect(deniedAgainRes.status).toBe(403);
  });
});
