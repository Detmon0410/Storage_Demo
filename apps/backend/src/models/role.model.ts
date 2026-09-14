import { prisma } from "../lib/prisma.js";

export const RoleModel = {
  getUserPermissionCodes: async (userId: number): Promise<Set<string>> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
        },
      },
    });
    const codes = new Set<string>();
    for (const ur of user?.userRoles ?? []) {
      for (const rp of ur.role.rolePermissions) {
        codes.add(rp.permission.permissionCode);
      }
    }
    return codes;
  },
  getUserRoleCodes: async (userId: number): Promise<string[]> => {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });
    return (user?.userRoles ?? []).map((ur) => ur.role.roleCode);
  },
};
