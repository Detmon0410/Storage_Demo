import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

const cases = [
  { path: "/api/products", allowedRole: "SALES_OFFICER" },
  { path: "/api/inventory-stocks", allowedRole: "SALES_OFFICER" },
  { path: "/api/import-orders", allowedRole: "IMPORT_COMPLIANCE_OFFICER", deniedRole: "SALES_OFFICER" },
  { path: "/api/sales-orders", allowedRole: "SALES_OFFICER" },
  { path: "/api/stock-transactions", allowedRole: "WAREHOUSE_DISTRIBUTION_OFFICER" },
] as const;

describe.each(cases)("GET $path VIEW-permission enforcement", (testCase) => {
  afterAll(cleanupTestUsers);

  it("does not block a user who has the required VIEW permission", async () => {
    const { username, password } = await createTestUserWithRoles(
      `reads_batchb_allowed_${testCase.path.replace(/\W/g, "_")}`,
      [testCase.allowedRole],
    );
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    const accessToken = loginRes.body.accessToken;

    const res = await request(app)
      .get(testCase.path)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).not.toBe(403);
  });

  const deniedTest = "deniedRole" in testCase ? it : it.skip;
  deniedTest("denies a user without the required VIEW permission with 403", async () => {
    const { username, password } = await createTestUserWithRoles(
      `reads_batchb_denied_${testCase.path.replace(/\W/g, "_")}`,
      [(testCase as { deniedRole: string }).deniedRole],
    );
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    const accessToken = loginRes.body.accessToken;

    const res = await request(app)
      .get(testCase.path)
      .set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });
});
