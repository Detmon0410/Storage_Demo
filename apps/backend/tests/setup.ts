import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

export { prisma };

export async function cleanupTestUsers() {
  const testUsers = await prisma.user.findMany({ where: { username: { startsWith: "test_" } } });
  const ids = testUsers.map((u) => u.id);
  if (ids.length === 0) return;
  await prisma.refreshToken.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
