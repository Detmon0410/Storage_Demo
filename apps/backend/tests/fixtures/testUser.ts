import * as argon2 from "@node-rs/argon2";
import { prisma } from "../setup.js";

export async function createTestUser(suffix: string, password = "TestPass123") {
  const username = `test_${suffix}_${Date.now()}`;
  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.create({ data: { username, passwordHash, status: "ACTIVE" } });
  return { user, username, password };
}
