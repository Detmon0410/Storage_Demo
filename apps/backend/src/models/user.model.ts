import { prisma } from "../lib/prisma.js";

export const UserModel = {
  findByUsername: (username: string) => prisma.user.findUnique({ where: { username: username.toLowerCase() } }),

  findById: (id: number) => prisma.user.findUnique({ where: { id } }),

  create: (data: { username: string; passwordHash: string }) =>
    prisma.user.create({ data: { username: data.username.toLowerCase(), passwordHash: data.passwordHash } }),
};
