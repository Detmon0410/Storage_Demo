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

describe("POST /api/auth/refresh", () => {
  afterAll(cleanupTestUsers);

  it("returns a new accessToken for a valid refresh-token cookie", async () => {
    const { username, password } = await createTestUser("refresh_valid");
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    const cookie = extractRefreshCookie(loginRes);

    const res = await request(app).post("/api/auth/refresh").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.accessToken.length).toBeGreaterThan(0);
  });

  it("returns 401 when no refresh-token cookie is present", async () => {
    const res = await request(app).post("/api/auth/refresh");

    expect(res.status).toBe(401);
  });
});
