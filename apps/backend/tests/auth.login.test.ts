import * as argon2 from "@node-rs/argon2";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUser } from "./fixtures/testUser.js";

describe("POST /api/auth/login", () => {
  afterAll(cleanupTestUsers);

  it("returns 200 with accessToken, user, and an HttpOnly SameSite=Strict refresh cookie for valid credentials", async () => {
    const { username, password } = await createTestUser("login_valid");

    const res = await request(app).post("/api/auth/login").send({ username, password });

    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe("string");
    expect(res.body.accessToken.length).toBeGreaterThan(0);
    expect(res.body.user.username).toBe(username);

    const setCookie = res.headers["set-cookie"];
    expect(setCookie).toBeDefined();
    const refreshCookie = (Array.isArray(setCookie) ? setCookie : [setCookie]).find((c: string) =>
      c.startsWith("refreshToken="),
    );
    expect(refreshCookie).toBeDefined();
    expect(refreshCookie).toMatch(/HttpOnly/i);
    expect(refreshCookie).toMatch(/SameSite=Strict/i);
  });

  it("returns 401 with a generic error for a wrong password", async () => {
    const { username } = await createTestUser("login_wrongpw");

    const res = await request(app).post("/api/auth/login").send({ username, password: "WrongPassword123" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid username or password" });
  });

  it("returns 401 with the identical generic error for an unknown username", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ username: `test_login_unknown_${Date.now()}`, password: "SomePassword123" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid username or password" });
  });

  it("returns 400 for missing fields", async () => {
    const res = await request(app).post("/api/auth/login").send({});

    expect(res.status).toBe(400);
  });

  it("returns 401 for an inactive user with correct password", async () => {
    const username = `test_login_inactive_${Date.now()}`;
    const password = "TestPass123";
    const passwordHash = await argon2.hash(password);
    await prisma.user.create({ data: { username, passwordHash, status: "INACTIVE" } });

    const res = await request(app).post("/api/auth/login").send({ username, password });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Invalid username or password" });
  });
});
