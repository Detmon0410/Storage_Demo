import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

const cases = [
  { method: "get", path: "/api/categories", code: "CATEGORY_VIEW", allowedRole: "SALES_OFFICER" },
  { method: "post", path: "/api/categories", code: "CATEGORY_CREATE", allowedRole: "SYSTEM_ADMIN", deniedRole: "SALES_OFFICER" },
  { method: "put", path: "/api/categories/1", code: "CATEGORY_EDIT", allowedRole: "SYSTEM_ADMIN", deniedRole: "SALES_OFFICER" },
  { method: "delete", path: "/api/categories/999999", code: "CATEGORY_DELETE", allowedRole: "SYSTEM_ADMIN", deniedRole: "SALES_OFFICER" },
] as const;

describe.each(cases)("requirePermission enforcement: $method $path requires $code", (testCase) => {
  afterAll(cleanupTestUsers);

  const deniedTest = testCase.deniedRole ? it : it.skip;
  deniedTest("denies a user without the required permission with 403", async () => {
    const { username, password } = await createTestUserWithRoles(
      `enforce_denied_${testCase.code}`,
      [testCase.deniedRole as string],
    );
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    const accessToken = loginRes.body.accessToken;

    const res = await request(app)
      [testCase.method](testCase.path)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it("does not block a user who has the required permission", async () => {
    const { username, password } = await createTestUserWithRoles(
      `enforce_allowed_${testCase.code}`,
      [testCase.allowedRole],
    );
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    const accessToken = loginRes.body.accessToken;

    const res = await request(app)
      [testCase.method](testCase.path)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({});

    expect(res.status).not.toBe(403);
  });
});
