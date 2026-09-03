import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app.js";

describe("CORS configuration", () => {
  it("does not send access-control-allow-origin for a non-allow-listed origin", async () => {
    const res = await request(app).get("/health").set("Origin", "http://evil.example.com");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("sends the matching access-control-allow-origin and credentials header for an allow-listed origin", async () => {
    const res = await request(app).get("/health").set("Origin", "http://localhost:5173");

    expect(res.status).toBe(200);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("still returns 200 with no Origin header (non-browser callers)", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
