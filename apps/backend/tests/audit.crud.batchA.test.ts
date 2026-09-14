import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUserWithRoles } from "./fixtures/testUser.js";

async function loginAs(username: string, password: string) {
  const res = await request(app).post("/api/auth/login").send({ username, password });
  return res.body.accessToken as string;
}

describe("Supplier CRUD audit logging (batch A representative)", () => {
  afterAll(cleanupTestUsers);

  it("creating a Supplier produces exactly one AuditLog row with entity/action/before/after", async () => {
    const { username, password } = await createTestUserWithRoles("audit_crud_batchA_create", ["SYSTEM_ADMIN"]);
    const accessToken = await loginAs(username, password);
    const supplierCode = `test_sup_${Date.now()}`;

    const createRes = await request(app)
      .post("/api/suppliers")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ supplierCode, supplierName: "Test Supplier" });

    expect(createRes.status).toBe(201);
    const supplierId = createRes.body.supplierId;

    const createLogs = await prisma.auditLog.findMany({
      where: { entity: "Supplier", entityId: String(supplierId), action: "create" },
    });
    expect(createLogs.length).toBe(1);
    expect(createLogs[0].before).toBeNull();
    expect((createLogs[0].after as { supplierCode: string }).supplierCode).toBe(supplierCode);

    const updateRes = await request(app)
      .put(`/api/suppliers/${supplierId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ supplierCode, supplierName: "Updated Supplier Name" });
    expect(updateRes.status).toBe(200);

    const updateLogs = await prisma.auditLog.findMany({
      where: { entity: "Supplier", entityId: String(supplierId), action: "update" },
    });
    expect(updateLogs.length).toBe(1);
    expect((updateLogs[0].before as { supplierName: string }).supplierName).toBe("Test Supplier");
    expect((updateLogs[0].after as { supplierName: string }).supplierName).toBe("Updated Supplier Name");

    const deleteRes = await request(app)
      .delete(`/api/suppliers/${supplierId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(deleteRes.status).toBe(204);

    const deleteLogs = await prisma.auditLog.findMany({
      where: { entity: "Supplier", entityId: String(supplierId), action: "delete" },
    });
    expect(deleteLogs.length).toBe(1);
    expect((deleteLogs[0].before as { supplierName: string }).supplierName).toBe("Updated Supplier Name");
    expect(deleteLogs[0].after).toBeNull();
  });
});
