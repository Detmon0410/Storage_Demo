import { afterAll, describe, expect, it } from "vitest";
import { cleanupTestUsers } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";
import { RoleModel } from "../src/models/role.model.js";

describe("RoleModel.getUserPermissionCodes permission union", () => {
  afterAll(cleanupTestUsers);

  it("a user with 2 roles has the union of both roles' permissions, not just one role's", async () => {
    const { user } = await createTestUserWithRoles("permission_union", [
      "SALES_OFFICER",
      "WAREHOUSE_DISTRIBUTION_OFFICER",
    ]);

    const codes = await RoleModel.getUserPermissionCodes(user.id);

    expect(codes.has("SALES_ORDER_CREATE")).toBe(true);
    expect(codes.has("INVENTORY_CREATE")).toBe(true);
  });
});
