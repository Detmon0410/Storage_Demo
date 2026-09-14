import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

async function loginAs(username: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ username, password });
  return res.body.accessToken as string;
}

const cases = [
  {
    name: "Customer DELETE denied for SALES_OFFICER",
    method: "delete" as const,
    path: () => `/api/customers/999999`,
    deniedRole: "SALES_OFFICER",
    body: undefined,
  },
  {
    name: "Supplier POST denied for SALES_OFFICER",
    method: "post" as const,
    path: () => `/api/suppliers`,
    deniedRole: "SALES_OFFICER",
    body: { supplierCode: `denied_${Date.now()}`, supplierName: "Denied Supplier" },
  },
  {
    name: "DashboardKpi POST denied for non-SYSTEM_ADMIN (SALES_OFFICER)",
    method: "post" as const,
    path: () => `/api/dashboard-kpis`,
    deniedRole: "SALES_OFFICER",
    body: { metricName: `denied_metric_${Date.now()}`, currentValue: 1, unit: "count", monthTrend: "up" },
  },
] as const;

describe.each(cases)("$name", (testCase) => {
  afterAll(cleanupTestUsers);

  it("returns 403 for a role without the required permission", async () => {
    const { username, password } = await createTestUserWithRoles(
      `writes_batchA_denied_${testCase.name.replace(/[^a-zA-Z]/g, "_")}`,
      [testCase.deniedRole],
    );
    const accessToken = await loginAs(username, password);

    const req = request(app)[testCase.method](testCase.path()).set("Authorization", `Bearer ${accessToken}`);
    const res = testCase.body ? await req.send(testCase.body) : await req;

    expect(res.status).toBe(403);
  });
});
