import { afterAll, describe, expect, it } from "vitest";
import { UserModel } from "../src/models/user.model.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

// The seeded database always has a real SYSTEM_ADMIN besides our test fixtures, so to exercise
// the "last active admin" guard we temporarily deactivate every OTHER active admin inside an
// interactive transaction that we force to roll back (by rejecting) once the assertion runs —
// this never permanently touches the seeded admin.
function withOnlyThisAdminActive<T>(excludingUserId: number, run: (tx: any) => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.user.updateMany({
      where: { status: "ACTIVE", id: { not: excludingUserId }, userRoles: { some: { role: { roleCode: "SYSTEM_ADMIN" } } } },
      data: { status: "INACTIVE" },
    });
    return run(tx);
  });
}

describe("UserModel management", () => {
  afterAll(cleanupTestUsers);

  it("assignRoles replaces the role set rather than adding to it", async () => {
    const { user } = await createTestUserWithRoles("mgmt_assign", ["SALES_OFFICER"]);

    await UserModel.assignRoles(user.id, ["SALES_OFFICER", "WAREHOUSE_DISTRIBUTION_OFFICER"]);
    let withRoles = await UserModel.findByIdWithRoles(user.id);
    expect(withRoles?.userRoles.map((ur) => ur.role.roleCode).sort()).toEqual(
      ["SALES_OFFICER", "WAREHOUSE_DISTRIBUTION_OFFICER"].sort(),
    );

    await UserModel.assignRoles(user.id, ["FINANCE_ACCOUNTING_OFFICER"]);
    withRoles = await UserModel.findByIdWithRoles(user.id);
    expect(withRoles?.userRoles.map((ur) => ur.role.roleCode)).toEqual(["FINANCE_ACCOUNTING_OFFICER"]);
  });

  it("deactivate throws 409 when user is the only active SYSTEM_ADMIN", async () => {
    const { user } = await createTestUserWithRoles("mgmt_lastadmin_deactivate", ["SYSTEM_ADMIN"]);

    await expect(
      withOnlyThisAdminActive(user.id, (tx) => UserModel.deactivate(user.id, tx)),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("deactivate succeeds when another active SYSTEM_ADMIN exists", async () => {
    await createTestUserWithRoles("mgmt_otheradmin", ["SYSTEM_ADMIN"]);
    const { user } = await createTestUserWithRoles("mgmt_deactivatable", ["SYSTEM_ADMIN"]);

    const updated = await UserModel.deactivate(user.id);
    expect(updated.status).toBe("INACTIVE");
  });

  it("assignRoles throws 409 when removing SYSTEM_ADMIN from the last active admin", async () => {
    const { user } = await createTestUserWithRoles("mgmt_lastadmin_roles", ["SYSTEM_ADMIN"]);

    await expect(
      withOnlyThisAdminActive(user.id, (tx) => UserModel.assignRoles(user.id, ["SALES_OFFICER"], tx)),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("reactivate sets status back to ACTIVE", async () => {
    await createTestUserWithRoles("mgmt_otheradmin2", ["SYSTEM_ADMIN"]);
    const { user } = await createTestUserWithRoles("mgmt_reactivate", ["SALES_OFFICER"]);
    await UserModel.deactivate(user.id);

    const reactivated = await UserModel.reactivate(user.id);
    expect(reactivated.status).toBe("ACTIVE");
  });

  it("findByIdWithRoles returns flattened role codes matching assignRoles input", async () => {
    const { user } = await createTestUserWithRoles("mgmt_findbyid", ["SALES_OFFICER", "FINANCE_ACCOUNTING_OFFICER"]);

    await UserModel.assignRoles(user.id, ["SALES_OFFICER"]);
    const withRoles = await UserModel.findByIdWithRoles(user.id);
    expect(withRoles?.userRoles.map((ur) => ur.role.roleCode)).toEqual(["SALES_OFFICER"]);
  });
});
