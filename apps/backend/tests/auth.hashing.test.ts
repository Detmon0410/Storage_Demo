import { afterAll, describe, expect, it } from "vitest";
import * as argon2 from "@node-rs/argon2";
import jwt from "jsonwebtoken";
import { signAccessToken, verifyAccessToken } from "../src/lib/jwt.js";
import { RefreshTokenModel } from "../src/models/refreshToken.model.js";
import { UserModel } from "../src/models/user.model.js";
import { createTestUser } from "./fixtures/testUser.js";
import { cleanupTestUsers, prisma } from "./setup.js";

afterAll(cleanupTestUsers);

describe("jwt", () => {
  it("signs and verifies an access token", () => {
    const token = signAccessToken({ userId: 1 });
    const payload = verifyAccessToken(token);
    expect(payload.userId).toBe(1);
  });

  it("rejects a token signed with a different secret", () => {
    const forged = jwt.sign({ userId: 1 }, "some-other-secret", { algorithm: "HS256", expiresIn: "15m" });
    expect(() => verifyAccessToken(forged)).toThrow();
  });

  it("rejects an expired token", async () => {
    const secret = process.env.JWT_SECRET ?? "dev-only-change-me-in-production-please-32chars-min";
    const expired = jwt.sign({ userId: 1 }, secret, { algorithm: "HS256", expiresIn: "-1s" });
    expect(() => verifyAccessToken(expired)).toThrow();
  });
});

describe("RefreshTokenModel", () => {
  it("creates a refresh token whose stored hash is not the raw value", async () => {
    const { user } = await createTestUser("refresh-create");
    const raw = await RefreshTokenModel.create(user.id, 60_000);
    const record = await prisma.refreshToken.findFirst({ where: { userId: user.id } });
    expect(record).not.toBeNull();
    expect(record!.tokenHash).not.toBe(raw);
  });

  it("findValid returns the record for a fresh unexpired unrevoked token, and null for revoked/expired", async () => {
    const { user } = await createTestUser("refresh-valid");
    const raw = await RefreshTokenModel.create(user.id, 60_000);
    const valid = await RefreshTokenModel.findValid(raw);
    expect(valid).not.toBeNull();
    expect(valid!.userId).toBe(user.id);

    const expiredRaw = await RefreshTokenModel.create(user.id, -1000);
    const expired = await RefreshTokenModel.findValid(expiredRaw);
    expect(expired).toBeNull();
  });

  it("revoke sets revokedAt and findValid subsequently returns null", async () => {
    const { user } = await createTestUser("refresh-revoke");
    const raw = await RefreshTokenModel.create(user.id, 60_000);
    await RefreshTokenModel.revoke(raw);
    const afterRevoke = await RefreshTokenModel.findValid(raw);
    expect(afterRevoke).toBeNull();
  });
});

describe("UserModel", () => {
  it("findByUsername is case-insensitive via lowercase normalization", async () => {
    const { username } = await createTestUser("case");
    const lowerSuffixMixedCase = username.toUpperCase();
    const found = await UserModel.findByUsername(lowerSuffixMixedCase);
    expect(found).not.toBeNull();
    expect(found!.username).toBe(username.toLowerCase());
  });

  it("stored passwordHash is never equal to the plaintext password", async () => {
    const { user, password } = await createTestUser("hash");
    expect(user.passwordHash).not.toBe(password);
    const verified = await argon2.verify(user.passwordHash, password);
    expect(verified).toBe(true);
  });
});
