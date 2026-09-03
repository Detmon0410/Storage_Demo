import jwt from "jsonwebtoken";
import { describe, expect, it, vi } from "vitest";
import { requireAuth, type AuthenticatedRequest } from "../src/middleware/auth.js";
import { HttpError } from "../src/middleware/errorHandler.js";
import { signAccessToken } from "../src/lib/jwt.js";

function buildReq(authorization?: string): AuthenticatedRequest {
  return {
    headers: authorization ? { authorization } : {},
  } as AuthenticatedRequest;
}

describe("requireAuth", () => {
  it("rejects a request with no Authorization header with 401", () => {
    const req = buildReq();
    const next = vi.fn();

    requireAuth(req, {} as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(401);
  });

  it("rejects a request with a non-Bearer scheme with 401", () => {
    const req = buildReq("Basic xyz");
    const next = vi.fn();

    requireAuth(req, {} as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(401);
  });

  it("rejects a token signed with the wrong secret with 401", () => {
    const badToken = jwt.sign({ userId: 42 }, "wrong-secret", { algorithm: "HS256", expiresIn: "15m" });
    const req = buildReq(`Bearer ${badToken}`);
    const next = vi.fn();

    requireAuth(req, {} as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(401);
  });

  it("rejects an expired token with 401", () => {
    const secret = process.env.JWT_SECRET ?? "dev-only-change-me-in-production-please-32chars-min";
    const expiredToken = jwt.sign({ userId: 42 }, secret, { algorithm: "HS256", expiresIn: -10 });
    const req = buildReq(`Bearer ${expiredToken}`);
    const next = vi.fn();

    requireAuth(req, {} as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(HttpError);
    expect((err as HttpError).status).toBe(401);
  });

  it("passes through with req.userId set for a valid token", () => {
    const token = signAccessToken({ userId: 42 });
    const req = buildReq(`Bearer ${token}`);
    const next = vi.fn();

    requireAuth(req, {} as never, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.userId).toBe(42);
  });
});
