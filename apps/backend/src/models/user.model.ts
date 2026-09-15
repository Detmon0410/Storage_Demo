import type { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";

type Client = PrismaClient | Prisma.TransactionClient;

async function assertNotLastAdmin(client: Client, excludingUserId: number) {
  const count = await client.user.count({
    where: { status: "ACTIVE", id: { not: excludingUserId }, userRoles: { some: { role: { roleCode: "SYSTEM_ADMIN" } } } },
  });
  if (count === 0) throw new HttpError(409, "At least one active System Admin must remain.");
}

export const UserModel = {
  findByUsername: (username: string) => prisma.user.findUnique({ where: { username: username.toLowerCase() } }),

  findById: (id: number) => prisma.user.findUnique({ where: { id } }),

  create: (data: { username: string; passwordHash: string }) =>
    prisma.user.create({ data: { username: data.username.toLowerCase(), passwordHash: data.passwordHash } }),

  update: (id: number, data: Partial<{ username: string; status: "ACTIVE" | "INACTIVE" }>, client: Client = prisma) =>
    client.user.update({ where: { id }, data }),

  deactivate: async (id: number, client: Client = prisma) => {
    await assertNotLastAdmin(client, id);
    return client.user.update({ where: { id }, data: { status: "INACTIVE" } });
  },

  reactivate: (id: number, client: Client = prisma) =>
    client.user.update({ where: { id }, data: { status: "ACTIVE" } }),

  resetPassword: (id: number, passwordHash: string, client: Client = prisma) =>
    client.user.update({ where: { id }, data: { passwordHash } }),

  assignRoles: async (id: number, roleCodes: string[], client: Client = prisma) => {
    const currentRoles = await client.userRole.findMany({ where: { userId: id }, include: { role: true } });
    const hadAdmin = currentRoles.some((ur) => ur.role.roleCode === "SYSTEM_ADMIN");
    if (hadAdmin && !roleCodes.includes("SYSTEM_ADMIN")) {
      await assertNotLastAdmin(client, id);
    }
    const roles = await client.role.findMany({ where: { roleCode: { in: roleCodes } } });
    await client.userRole.deleteMany({ where: { userId: id } });
    await client.userRole.createMany({ data: roles.map((r) => ({ userId: id, roleId: r.roleId })) });
    return roles;
  },

  findAllWithRoles: () =>
    prisma.user.findMany({ orderBy: { id: "asc" }, include: { userRoles: { include: { role: true } } } }),

  findByIdWithRoles: (id: number) =>
    prisma.user.findUnique({ where: { id }, include: { userRoles: { include: { role: true } } } }),
};
