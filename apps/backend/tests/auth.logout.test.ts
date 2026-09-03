import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers } from "./setup.js";
import { createTestUser } from "./fixtures/testUser.js";

function extractRefreshCookie(res: request.Response): string {
  const setCookie = res.headers["set-cookie"];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const refreshCookie = cookies.find((c: string) => c.startsWith("refreshToken="));
  if (!refreshCookie) throw new Error("refreshToken cookie not found");
  return refreshCookie.split(";")[0];
}

describe("POST /api/auth/logout", () => {
  afterAll(cleanupTestUsers);

  it("revokes the refresh token so a subsequent refresh fails", async () => {
    const { username, password } = await createTestUser("logout_revoke");
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    const cookie = extractRefreshCookie(loginRes);
    const accessToken = loginRes.body.accessToken;

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", cookie)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(logoutRes.status).toBe(204);

    const refreshRes = await request(app).post("/api/auth/refresh").set("Cookie", cookie);

    expect(refreshRes.status).toBe(401);
  });
});
