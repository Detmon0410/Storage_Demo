import * as argon2 from "@node-rs/argon2";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import { UserModel } from "../models/user.model.js";
import { RefreshTokenModel } from "../models/refreshToken.model.js";
import { signAccessToken } from "../lib/jwt.js";
import type { AuthenticatedRequest } from "../middleware/auth.js";

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — fixed-expiry, no rotation (Claude's discretion per CONTEXT.md)
const REFRESH_COOKIE_NAME = "refreshToken";
const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: REFRESH_TTL_MS,
  path: "/api/auth",
};

const loginSchema = z.object({
  username: z.string().min(1, "Username and password required"),
  password: z.string().min(8, "Username and password required"),
});

// Dummy Argon2id hash used to run argon2.verify against a fixed cost when the user doesn't
// exist, so an unknown username takes the same time/code path as a wrong password (no
// enumeration signal via response timing or shape).
const DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$c29tZWhhc2h2YWx1ZQ";

export const login = asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Username and password required");
  const { username, password } = parsed.data;

  const user = await UserModel.findByUsername(username);
  const valid = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, password).catch(() => false);

  if (!user || !valid || user.status !== "ACTIVE") {
    throw new HttpError(401, "Invalid username or password");
  }

  const accessToken = signAccessToken({ userId: user.id });
  const refreshToken = await RefreshTokenModel.create(user.id, REFRESH_TTL_MS);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
  res.json({ accessToken, user: { id: user.id, username: user.username } });
});

export const refresh = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!raw) throw new HttpError(401, "Not authenticated");
  const record = await RefreshTokenModel.findValid(raw);
  if (!record) throw new HttpError(401, "Session expired");
  const accessToken = signAccessToken({ userId: record.userId });
  res.json({ accessToken });
});

export const logout = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  if (raw) await RefreshTokenModel.revoke(raw);
  res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/auth" });
  res.status(204).end();
});
