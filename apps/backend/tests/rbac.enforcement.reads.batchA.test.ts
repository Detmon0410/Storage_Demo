import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

const cases = [
  { path: "/api/customers", allowedRole: "SALES_OFFICER" },
  { path: "/api/customer-licenses", allowedRole: "IMPORT_COMPLIANCE_OFFICER" },
  { path: "/api/dashboard-kpis", allowedRole: "SALES_OFFICER" },
  { path: "/api/licenses", allowedRole: "IMPORT_COMPLIANCE_OFFICER" },
  { path: "/api/suppliers", allowedRole: "IMPORT_COMPLIANCE_OFFICER", deniedRole: "SALES_OFFICER" },
] as const;

describe.each(cases)("GET $path *_VIEW enforcement", (testCase) => {
  afterAll(cleanupTestUsers);

  it("does not block a user who has the required VIEW permission", async () => {
    const { username, password } = await createTestUserWithRoles(
      `reads_batchA_allowed_${testCase.path.replace(/[^a-zA-Z]/g, "_")}`,
      [testCase.allowedRole],
    );
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    const accessToken = loginRes.body.accessToken;

    const res = await request(app).get(testCase.path).set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).not.toBe(403);
  });

  const deniedTest = "deniedRole" in testCase ? it : it.skip;
  deniedTest("denies a user without the required VIEW permission with 403", async () => {
    const { username, password } = await createTestUserWithRoles(
      `reads_batchA_denied_${testCase.path.replace(/[^a-zA-Z]/g, "_")}`,
      [(testCase as { deniedRole: string }).deniedRole],
    );
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    const accessToken = loginRes.body.accessToken;

    const res = await request(app).get(testCase.path).set("Authorization", `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
  });
});
