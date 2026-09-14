import { describe, expect, it } from "vitest";
import { prisma } from "./setup.js";

const EXPECTED_ROLE_CODES = [
  "SYSTEM_ADMIN",
  "MANAGER_APPROVER",
  "IMPORT_COMPLIANCE_OFFICER",
  "WAREHOUSE_DISTRIBUTION_OFFICER",
  "SALES_OFFICER",
  "FINANCE_ACCOUNTING_OFFICER",
];

describe("RBAC seed", () => {
  it("creates exactly the 6 roles defined by the role doc", async () => {
    const roles = await prisma.role.findMany();
    expect(roles).toHaveLength(6);
    const roleCodes = roles.map((r) => r.roleCode).sort();
    expect(roleCodes).toEqual([...EXPECTED_ROLE_CODES].sort());
  });

  it("assigns the seeded admin user the SYSTEM_ADMIN role", async () => {
    const adminUser = await prisma.user.findUnique({ where: { username: "admin" } });
    expect(adminUser).toBeTruthy();

    const systemAdminRole = await prisma.role.findUnique({ where: { roleCode: "SYSTEM_ADMIN" } });
    expect(systemAdminRole).toBeTruthy();

    const userRole = await prisma.userRole.findUnique({
      where: { userId_roleId: { userId: adminUser!.id, roleId: systemAdminRole!.roleId } },
    });
    expect(userRole).toBeTruthy();
  });

  it("assigns permission codes to roles matching the role doc §7 matrix", async () => {
    async function roleCodesForPermission(permissionCode: string) {
      const permission = await prisma.permission.findUnique({
        where: { permissionCode },
        include: { rolePermissions: { include: { role: true } } },
      });
      expect(permission).toBeTruthy();
      return permission!.rolePermissions.map((rp) => rp.role.roleCode).sort();
    }

    // PRODUCT_VIEW -> all 6 roles
    expect(await roleCodesForPermission("PRODUCT_VIEW")).toEqual([...EXPECTED_ROLE_CODES].sort());

    // USER_MANAGEMENT_FULL -> SYSTEM_ADMIN only
    expect(await roleCodesForPermission("USER_MANAGEMENT_FULL")).toEqual(["SYSTEM_ADMIN"]);

    // IMPORT_ORDER_APPROVE -> SYSTEM_ADMIN and MANAGER_APPROVER only
    expect(await roleCodesForPermission("IMPORT_ORDER_APPROVE")).toEqual(["MANAGER_APPROVER", "SYSTEM_ADMIN"]);
  });
});
