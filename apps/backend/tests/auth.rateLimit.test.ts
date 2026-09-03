import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("POST /api/auth/login rate limiting", () => {
  it("rejects the 11th login attempt within the window with 429", async () => {
    const badCreds = { username: `test_ratelimit_${Date.now()}`, password: "WrongPassword123" };

    for (let i = 0; i < 10; i++) {
      const res = await request(app).post("/api/auth/login").send(badCreds);
      expect(res.status).toBe(401);
    }

    const eleventh = await request(app).post("/api/auth/login").send(badCreds);
    expect(eleventh.status).toBe(429);
    expect(eleventh.body).toEqual({ error: "Too many login attempts, please try again later" });
  });
});
