import * as argon2 from "@node-rs/argon2";
import { prisma } from "../setup.js";

export async function createTestUser(suffix: string, password = "TestPass123") {
  const username = `test_${suffix}_${Date.now()}`;
  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.create({ data: { username, passwordHash, status: "ACTIVE" } });
  return { user, username, password };
}

export async function createTestUserWithRoles(suffix: string, roleCodes: string[], password = "TestPass123") {
  const { user, username, password: pw } = await createTestUser(suffix, password);
  const roles = await prisma.role.findMany({ where: { roleCode: { in: roleCodes } } });
  await prisma.userRole.createMany({ data: roles.map((r) => ({ userId: user.id, roleId: r.roleId })) });
  return { user, username, password: pw };
}
