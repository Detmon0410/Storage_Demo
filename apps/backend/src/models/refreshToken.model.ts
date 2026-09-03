import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../lib/prisma.js";

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("hex");
}

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export const RefreshTokenModel = {
  async create(userId: number, ttlMs: number): Promise<string> {
    const raw = generateOpaqueToken();
    await prisma.refreshToken.create({
      data: { tokenHash: hash(raw), userId, expiresAt: new Date(Date.now() + ttlMs) },
    });
    return raw;
  },

  async findValid(raw: string) {
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(raw) } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) return null;
    return record;
  },

  async revoke(raw: string): Promise<void> {
    await prisma.refreshToken.updateMany({ where: { tokenHash: hash(raw) }, data: { revokedAt: new Date() } });
  },
};
