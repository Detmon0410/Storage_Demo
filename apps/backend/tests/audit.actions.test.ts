import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUser } from "./fixtures/testUser.js";

function extractRefreshCookie(res: request.Response): string {
  const setCookie = res.headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const refreshCookie = cookies.find((c: string) => c.startsWith("refreshToken="));
  if (!refreshCookie) throw new Error("refreshToken cookie not found");
  return refreshCookie.split(";")[0];
}

describe("Login/logout audit logging", () => {
  afterAll(cleanupTestUsers);

  it("login produces exactly one AuditLog row with action 'login' and matching userId", async () => {
    const { user, username, password } = await createTestUser("audit_login");

    const auditCountBefore = await prisma.auditLog.count({
      where: { userId: user.id, action: "login" },
    });

    const res = await request(app).post("/api/auth/login").send({ username, password });
    expect(res.status).toBe(200);

    const logs = await prisma.auditLog.findMany({
      where: { userId: user.id, action: "login" },
    });

    expect(logs.length).toBe(auditCountBefore + 1);
  });

  it("logout produces exactly one AuditLog row with action 'logout' and matching userId", async () => {
    const { user, username, password } = await createTestUser("audit_logout");

    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    const cookie = extractRefreshCookie(loginRes);
    const accessToken = loginRes.body.accessToken;

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookie)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(logoutRes.status).toBe(204);

    const logs = await prisma.auditLog.findMany({
      where: { userId: user.id, action: "logout" },
    });

    expect(logs.length).toBe(1);
  });
});
