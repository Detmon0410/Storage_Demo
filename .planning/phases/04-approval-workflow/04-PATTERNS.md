# Phase 4: Approval Workflow - Pattern Map

**Mapped:** 2026-09-16
**Files analyzed:** 10 (schema + 2 controllers + 2 models + 1 new util + seed + tests)
**Analogs found:** 9 / 10 (all files are modifications of existing files except one new util; every file has a same-file "before" state as its own best analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/backend/prisma/schema.prisma` (SalesOrder, ImportOrder models + new OrderStatus enum) | model/config | CRUD | Same file — `CustomerLicenseStatus`/`UserStatus` enum blocks (lines 156-162, 287-290) | exact (enum pattern), self-modify (columns) |
| `apps/backend/src/utils/importValueGate.ts` (NEW) | utility (transaction guard) | request-response (soft-block, no persistence) | `apps/backend/src/utils/creditDiscountGate.ts` | exact — same shape, same call site pattern |
| `apps/backend/src/models/salesOrder.model.ts` | model | CRUD (transaction-scoped) | Self-modify; secondary analog `apps/backend/src/models/importOrder.model.ts` for RECEIVED-gate precedent | self-modify |
| `apps/backend/src/models/importOrder.model.ts` | model | CRUD (transaction-scoped) | Self-modify; secondary analog `salesOrder.model.ts`'s `applyLotGuardsTx`/threshold-routing pattern | role-match |
| `apps/backend/src/controllers/salesOrder.controller.ts` | controller | request-response | Self-modify; secondary analog `importOrder.controller.ts` (transition-validator + approve/reject shape) | self-modify |
| `apps/backend/src/controllers/importOrder.controller.ts` | controller | request-response | Self-modify; secondary analog `salesOrder.controller.ts` | self-modify |
| `apps/backend/prisma/seed.ts` (SalesOrder/ImportOrder seed rows) | config/fixture | batch | Self-modify (existing seed rows lines ~94-250, ~404-474, ~937) | self-modify |
| `apps/backend/tests/order.noSelfApproval.test.ts` | test | request-response (integration) | Self-modify — existing assertions on `deliveryStatus`/`status`/`approver` need updating to `status`/`approvedById`/`approvedAt`/`rejectionReason` | self-modify |
| `apps/backend/tests/salesOrder.creditLimit.test.ts`, `salesOrder.discountLimit.test.ts` | test | request-response (integration) | Self-modify — `requiresApproval` assertions → `status` assertions | self-modify |
| `apps/backend/tests/importOrder.valueThreshold.test.ts` (NEW) | test | request-response (integration) | `apps/backend/tests/salesOrder.creditLimit.test.ts` (closest existing threshold-test shape) + `apps/backend/tests/creditDiscountGate.test.ts` (unit-level guard test shape) | role-match |

## Pattern Assignments

### `apps/backend/prisma/schema.prisma`

**Analog:** existing enum blocks in the same file (`CustomerLicenseStatus` lines 156-162, `UserStatus` lines 287-290), plus the `User` relation-array pattern (lines 292-306).

**Existing enum pattern** (lines 156-162):
```prisma
enum CustomerLicenseStatus {
  ACTIVE
  EXPIRED
  REVOKED
  SUSPENDED
  PENDING
}
```
Copy this exact shape for the new enum:
```prisma
enum OrderStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  REJECTED
  CANCELLED
}
```

**Current fields being replaced/renamed** — `ImportOrder` (lines 99-120):
```prisma
model ImportOrder {
  ...
  totalValue     Decimal  @map("total_value") @db.Decimal(14, 2)
  taxTotal       Decimal  @default(0) @map("tax_total") @db.Decimal(14, 2)
  status         String
  approver       String?
  customsEntryNo String?  @map("customs_entry_no")
  createdById    Int?     @map("created_by_id")
  ...
}
```
`status` (String) must be renamed to `logisticsStatus` (`@map("logistics_status")`, narrowed to STAGING/CUSTOMS_CLEARED/RECEIVED/ISSUE) BEFORE a new `status OrderStatus` column is added — same-name collision, must be two logical migration steps (rename, then add). `approver` (String?) is removed in favor of `approvedById`.

**Current fields being replaced** — `SalesOrder` (lines 210-235):
```prisma
model SalesOrder {
  ...
  deliveryStatus   String  @map("delivery_status")
  invoiceNo        String  @map("invoice_no")
  approver         String?
  createdById      Int?    @map("created_by_id")
  requiresApproval Boolean @default(false) @map("requires_approval")
  updatedById      Int?    @map("updated_by_id")
  ...
}
```
`requiresApproval` and `approver` (String?) are removed; add `status OrderStatus`, `approvedById Int?`, `approvedAt DateTime?`, `rejectionReason String?`.

**FK relation pattern to copy** (User relations, lines 292-306):
```prisma
model User {
  id ...
  createdImportOrders ImportOrder[] @relation("CreatedImportOrders")
  createdSalesOrders  SalesOrder[]  @relation("CreatedSalesOrders")
  updatedSalesOrders  SalesOrder[]  @relation("UpdatedSalesOrders")
  ...
}
```
And the corresponding FK field + relation on the order model (`SalesOrder`, lines 231-232):
```prisma
createdBy User? @relation("CreatedSalesOrders", fields: [createdById], references: [id], onDelete: SetNull)
updatedBy User? @relation("UpdatedSalesOrders", fields: [updatedById], references: [id], onDelete: SetNull)
```
Copy this exact `onDelete: SetNull` FK shape for the new `approvedBy User? @relation("ApprovedSalesOrders"/"ApprovedImportOrders", fields: [approvedById], references: [id], onDelete: SetNull)` on both models, and add the reciprocal `approvedSalesOrders`/`approvedImportOrders` arrays on `User`.

---

### `apps/backend/src/utils/importValueGate.ts` (NEW)

**Analog:** `apps/backend/src/utils/creditDiscountGate.ts` (36 lines, full file — copy shape exactly)

**Full existing pattern to mirror**:
```typescript
import type { Prisma } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import { roundHalfUp } from "./rounding.js";

export interface CreditDiscountCheckItem {
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate?: number;
}

export const assertCreditAndDiscountTx = async (
  tx: Prisma.TransactionClient,
  customerId: number,
  items: CreditDiscountCheckItem[],
) => {
  const customer = await tx.customer.findUnique({ where: { customerId } });
  if (!customer) throw new HttpError(404, "Customer not found");

  // Re-derive the order's net value server-side from the submitted items — never trust a
  // client-computed total or a client-submitted requiresApproval flag.
  const orderNetValue = items.reduce((sum, item) => {
    const discounted = item.quantity * item.unitPrice * (1 - item.discount / 100);
    const taxAmount = discounted * ((item.taxRate ?? 0) / 100);
    return sum + roundHalfUp(discounted + taxAmount, 2);
  }, 0);

  const projectedBalance = roundHalfUp(Number(customer.currentBalance) + orderNetValue, 2);
  const overCredit = projectedBalance > Number(customer.creditLimit);
  const overDiscount = items.some((item) => item.discount > Number(customer.standardDiscount));

  // Soft-block only — the caller sets status from this result; must NOT throw here (contrast
  // with assertLotQuantityTx/assertProductsNotBlockedTx, which hard-reject).
  return { requiresApproval: overCredit || overDiscount };
};
```

**New file, same shape** (no DB lookup needed since `totalValue` is already computed server-side by `importOrder.model.ts`'s `orderTotals()`):
```typescript
// Source pattern: apps/backend/src/utils/creditDiscountGate.ts
export const IMPORT_ORDER_APPROVAL_THRESHOLD = 50_000; // [ASSUMED] placeholder pending finance
// input — no source doc in this repo specifies a real number; tune here, single source of truth.

export const assertImportValueThresholdTx = (totalValue: number) => ({
  requiresApproval: totalValue > IMPORT_ORDER_APPROVAL_THRESHOLD,
});
```
Note this variant doesn't need `tx` at all (pure function on an already-computed number) — keep the `Tx` suffix for naming consistency with the call site even though it takes no transaction client, OR drop the suffix; either is fine since RESEARCH.md's own example already shows it as non-async/no-tx-param.

---

### `apps/backend/src/models/salesOrder.model.ts`

**Analog:** self (existing `applyLotGuardsTx` + stock-decrement gating, lines 66-73, 118, 135-140, 193, 208-211)

**Current guard composition pattern** (lines 66-73):
```typescript
const applyLotGuardsTx = async (tx: Prisma.TransactionClient, customerId: number, items: SalesOrderItemInput[]) => {
  // ENFORCE-02: hard reject regardless of approval outcome
  await assertLotQuantityTx(tx, items.map((i) => ({ inventoryStockId: i.inventoryStockId, quantity: i.quantity })));
  // ENFORCE-03/ENFORCE-04: soft-block — never throws
  return assertCreditAndDiscountTx(tx, customerId, items);
};
```
Keep this exact ordering (hard lot check first, soft threshold check second) — do not merge/reorder (RESEARCH.md Pitfall 3).

**Current status-derivation + conditional decrement** (lines 118, 135-140):
```typescript
const { requiresApproval } = await applyLotGuardsTx(tx as Prisma.TransactionClient, data.customerId, data.items);
const order = await tx.salesOrder.create({
  data: { ..., requiresApproval },
  include: withRelations,
});
// D-05: only decrement lots immediately if the order does NOT require approval.
if (!requiresApproval) {
  await createStockOutTx(tx as Prisma.TransactionClient, data.orderNo, data.items);
}
```
Rewire to (per RESEARCH.md Pattern 1):
```typescript
const { requiresApproval } = await applyLotGuardsTx(tx as Prisma.TransactionClient, data.customerId, data.items);
const status: OrderStatus = requiresApproval ? "PENDING_APPROVAL" : "APPROVED";
const order = await tx.salesOrder.create({
  data: { ..., status }, // requiresApproval field removed from schema
  include: withRelations,
});
if (status === "APPROVED") {
  await createStockOutTx(tx as Prisma.TransactionClient, data.orderNo, data.items);
}
```
Same rewrite shape applies to `update()` (lines 193, 208-211) — identical structure, just inside the `update` method body.

---

### `apps/backend/src/models/importOrder.model.ts`

**Analog (for threshold wiring):** `salesOrder.model.ts`'s `applyLotGuardsTx`→status-derivation pattern above.
**Analog (for RECEIVED-gate, must be preserved):** self, lines 129, 193 (`data.status === "RECEIVED"` / `data.status === "RECEIVED" && existingStatus.status !== "RECEIVED"`).

**Current RECEIVED-gate** (create, line 129; update, line 193) — **critical: re-point to `logisticsStatus`, not the new `status`**:
```typescript
// create() — line 129
if (data.status === "RECEIVED") {
  const createdItems = await tx.importOrderItem.findMany({ where: { importOrderId: order.importOrderId } });
  ...
  await createOrUpdateLotsFromReceivingTx(tx as Prisma.TransactionClient, data.orderNo, itemsWithIds);
}

// update() — line 193
if (data.status === "RECEIVED" && existingStatus.status !== "RECEIVED") { ... }
```
After D-02's rename, this becomes `data.logisticsStatus === "RECEIVED"` / `existingLogisticsStatus.logisticsStatus !== "RECEIVED"` — AND per RESEARCH.md's Anti-Pattern/Pitfall #4, must ALSO check `order status === "APPROVED"` (both independent gates must pass):
```typescript
if (data.logisticsStatus === "RECEIVED" && resolvedApprovalStatus === "APPROVED") {
  await createOrUpdateLotsFromReceivingTx(tx as Prisma.TransactionClient, data.orderNo, itemsWithIds);
}
```

**New threshold wiring to add** — mirror `salesOrder.model.ts`'s pattern exactly:
```typescript
import { assertImportValueThresholdTx } from "../utils/importValueGate.js";
// ... inside create():
const { totalValue } = orderTotals(rows);
const { requiresApproval } = assertImportValueThresholdTx(totalValue);
const status: OrderStatus = requiresApproval ? "PENDING_APPROVAL" : "APPROVED";
```

---

### `apps/backend/src/controllers/salesOrder.controller.ts`

**Analog:** self, transition-validator block (lines 37-57) + approve/reject actions (lines 170-242).

**Current transition validator to split** (lines 37-57):
```typescript
const DELIVERY_STATUS_VALUES = ["PENDING", "SHIPPING", "DELIVERED", "RETURNED", "DAMAGED", "APPROVED", "REJECTED"];
const DELIVERY_PIPELINE: Record<string, number> = { PENDING: 0, SHIPPING: 1, DELIVERED: 2 };
const POST_DELIVERY_STATES = new Set(["DELIVERED", "RETURNED", "DAMAGED"]);

const assertValidDeliveryStatusTransition = (newStatus: string, currentStatus?: string) => {
  if (!DELIVERY_STATUS_VALUES.includes(newStatus)) {
    throw new HttpError(400, `invalid deliveryStatus "${newStatus}"; must be one of ${DELIVERY_STATUS_VALUES.join(", ")}`);
  }
  if (currentStatus == null || currentStatus === newStatus) return;
  if (currentStatus === "APPROVED" || currentStatus === "REJECTED") {
    throw new HttpError(400, `invalid status transition: cannot change deliveryStatus from terminal state "${currentStatus}"`);
  }
  ...
};
```
Drop `APPROVED`/`REJECTED` from `DELIVERY_STATUS_VALUES` (D-03) and remove the terminal-state check tied to those two values (they no longer live on this field). Add a second, independent validator for the new `status` enum, following RESEARCH.md's Pattern 3 exactly:
```typescript
const ORDER_STATUS_VALUES = ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"];
const assertValidOrderStatusTransition = (newStatus: string, currentStatus?: string) => {
  if (!ORDER_STATUS_VALUES.includes(newStatus)) {
    throw new HttpError(400, `invalid status "${newStatus}"`);
  }
  if (currentStatus === "APPROVED" || currentStatus === "REJECTED" || currentStatus === "CANCELLED") {
    throw new HttpError(400, `invalid status transition: cannot change status from terminal state "${currentStatus}"`);
  }
  if (newStatus === "CANCELLED" && !["DRAFT", "PENDING_APPROVAL"].includes(currentStatus ?? "DRAFT")) {
    throw new HttpError(400, `CANCELLED is only reachable from DRAFT or PENDING_APPROVAL`);
  }
};
```

**Create/update client-submitted-status block, must extend to new field** (lines 77-79, 111-113):
```typescript
if (deliveryStatus === "APPROVED" || deliveryStatus === "REJECTED") {
  throw new HttpError(400, "Use the dedicated approve/reject endpoint to change status to APPROVED or REJECTED");
}
```
Add the equivalent block for `status` — never let create/update set `status` to `APPROVED`/`PENDING_APPROVAL`/`REJECTED` directly; `status` is always server-derived from the threshold guard, never accepted from the request body at all (simplest: don't even destructure `status` out of `req.body` in create/update — only the approve/reject actions write it).

**Approve action to rewrite** (lines 170-213) — current:
```typescript
export const approveSalesOrder = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const salesOrderId = Number(req.params.id);
  const order = await prisma.$transaction(async (tx) => {
    const existing = await tx.salesOrder.findUnique({ where: { salesOrderId } });
    if (!existing) throw new HttpError(404, "Sales order not found");
    if (existing.createdById != null && existing.createdById === req.userId) {
      throw new HttpError(403, "You cannot approve an order you created");
    }
    if (existing.updatedById != null && existing.updatedById === req.userId) {
      throw new HttpError(403, "You cannot approve an order you last edited");
    }
    if (existing.requiresApproval) {
      const items = await tx.salesOrderItem.findMany({ where: { salesOrderId } });
      await assertLotQuantityTx(tx, items.map((i) => ({ inventoryStockId: i.inventoryStockId, quantity: i.quantity })));
      const referenceNo = salesOrderStockReference(existing.orderNo);
      for (const [index, item] of items.entries()) {
        await createStockTransactionTx(tx, { ... });
      }
    }
    const approverUser = await tx.user.findUnique({ where: { id: req.userId! }, select: { username: true } });
    const updated = await tx.salesOrder.update({
      where: { salesOrderId },
      data: { deliveryStatus: "APPROVED", approver: approverUser?.username ?? null, requiresApproval: false },
    });
    await AuditLogModel.record(tx, { entity: "SalesOrder", entityId: salesOrderId, action: "approve", userId: req.userId ?? null, before: existing, after: updated });
    return updated;
  });
  res.json(order);
});
```
No-self-approval check (`createdById`/`updatedById` vs `req.userId`) is reused **verbatim, unchanged** — this is the shared pattern (see Shared Patterns below). The rewrite only changes: (1) `existing.requiresApproval` → `existing.status === "PENDING_APPROVAL"`, (2) the final `update` call's `data` block:
```typescript
data: { status: "APPROVED", approvedById: req.userId, approvedAt: new Date() },
```
(3) drop the `approverUser` username lookup entirely — `approvedById` is now a direct FK write, no lookup needed unless the response needs to include the approver's username via `include`.

**Reject action to rewrite** (lines 215-242) — same shape, current `data: { deliveryStatus: "REJECTED", approver: approverUser?.username ?? null }` becomes:
```typescript
data: { status: "REJECTED", approvedById: req.userId, approvedAt: new Date(), rejectionReason: req.body?.reason ?? null },
```
Note the current code stashes `rejectionReason` only into the `AuditLog.after` snapshot (line 237: `after: { ...updated, rejectionReason: req.body?.reason ?? null }`) rather than persisting it on the order row — this must change to an actual column write per APPROVAL-04, not just an audit-log annotation.

---

### `apps/backend/src/controllers/importOrder.controller.ts`

**Analog:** self, transition-validator block (lines 33-56) + approve/reject actions (lines 173-223); secondary analog `salesOrder.controller.ts`'s no-self-approval check on `updatedById` (import currently only checks `createdById` — no `updatedById` field exists on `ImportOrder` today, confirm during planning whether one should be added for parity, per CONTEXT.md "reuse as-is for both models").

**Current conflated pipeline to split** (lines 33-41) — RESEARCH.md Pitfall 2 applies directly here:
```typescript
const IMPORT_STATUS_VALUES = ["STAGING", "PENDING_APPROVAL", "APPROVED", "CUSTOMS_CLEARED", "RECEIVED", "ISSUE", "REJECTED"];
const IMPORT_STATUS_PIPELINE: Record<string, number> = {
  STAGING: 0, PENDING_APPROVAL: 1, APPROVED: 2, CUSTOMS_CLEARED: 3, RECEIVED: 4, ISSUE: 5,
};
```
Split into a fresh `LOGISTICS_STATUS_VALUES = ["STAGING", "CUSTOMS_CLEARED", "RECEIVED", "ISSUE"]` with fresh pipeline indices (do not edit the old array in place — RESEARCH.md warns index shifts silently misorder validation), plus reuse `salesOrder.controller.ts`'s new `ORDER_STATUS_VALUES`/`assertValidOrderStatusTransition` shape (identical 5-value enum, shared logic — consider extracting to a shared util if both controllers need the exact same function, otherwise duplicate per file consistent with this codebase's existing per-controller duplication style, e.g. `DELIVERY_STATUS_VALUES` vs `IMPORT_STATUS_VALUES` are already separately defined per controller today).

**Approve/reject actions to rewrite** (lines 173-223) — same rewrite shape as `salesOrder.controller.ts` above: replace `data: { status: "APPROVED", approver: approverUser?.username ?? null }` with `data: { status: "APPROVED", approvedById: req.userId, approvedAt: new Date() }`, and reject similarly with `rejectionReason: req.body?.reason ?? null` persisted as a real column.

**Create/update client-submitted-status block** (lines 74-76, 112-114) — same pattern as sales order, extend to block client-submitted `status` on the new field; also note `status` is destructured from `req.body` at line 69/109 and passed straight through to `ImportOrderModel.create`/`update` today — after the split, `status` (the request body field) should stop being accepted for the approval enum entirely (server-derives it from the threshold guard) while a distinct `logisticsStatus` field is accepted from the client for the STAGING/CUSTOMS_CLEARED/RECEIVED/ISSUE pipeline.

---

### `apps/backend/prisma/seed.ts`

**Current pattern** (repeated ~14 times for import orders, lines 94-250, 404-474, and once more at 937):
```typescript
{
  ...,
  status: "STAGING", // or PENDING_APPROVAL/APPROVED/CUSTOMS_CLEARED/RECEIVED/ISSUE/REJECTED
  approver: "Kumiko Sato (Manager)", // or "-" or "Makoto Tanaka (Manager)"
  ...
}
```
Each row needs splitting into `logisticsStatus` (STAGING/CUSTOMS_CLEARED/RECEIVED/ISSUE only) + `status` (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED) + `approvedById` (a real seeded User id, looked up the same way seed.ts already looks up other FK ids for these rows) + `approvedAt`/`rejectionReason` where applicable. Use RESEARCH.md's Data Migration mapping table as the authoritative value-mapping reference (Code Examples section, `[ASSUMED]` — flagged for confirmation but reasonable default). `nullable(order.approver)` at lines 737, 888 (a display/serialization helper in seed.ts or a related script) also needs updating to read the new fields instead.

---

### `apps/backend/tests/order.noSelfApproval.test.ts`

**Analog:** self — every existing test in this file follows the same 3-step shape (create as creator → self-approve/reject as creator → approve/reject as different approver), which is unchanged by this phase; only the field-name assertions inside change.

**Current assertion pattern to update** (lines 151, 187, 223, 254, 299):
```typescript
expect(approveRes.status).toBe(200);
expect(approveRes.body.status).toBe("APPROVED");        // import — stays correct, still `status`
...
expect(approveRes.body.deliveryStatus).toBe("APPROVED"); // sales — WRONG after split, deliveryStatus stays PENDING
```
Fix: change every `approveRes.body.deliveryStatus`/`rejectRes.body.deliveryStatus` assertion for SalesOrder to `approveRes.body.status`/`rejectRes.body.status` (RESEARCH.md Pitfall 1 — this exact bug is flagged). Add new assertions for `approvedById`, `approvedAt`, and (on reject) `rejectionReason`:
```typescript
expect(approveRes.body.status).toBe("APPROVED");
expect(approveRes.body.approvedById).toBe(approver.id); // or whatever id field createTestUserWithRoles returns
expect(approveRes.body.approvedAt).not.toBeNull();
// on reject:
expect(rejectRes.body.rejectionReason).toBe("not compliant");
```
The create-body fixture at lines 133 (`status: "STAGING"`) must become `logisticsStatus: "STAGING"` for import orders (client no longer sends the approval `status` on create).

---

### `apps/backend/tests/salesOrder.creditLimit.test.ts` / `salesOrder.discountLimit.test.ts`

**Analog:** self — full existing structure (fixtures in `beforeAll`, cleanup in `afterAll`, 3 `it` blocks: over-limit/soft-block, approve-and-decrement, under-limit/immediate-decrement) is unchanged; only the `requiresApproval` assertions change.

**Current assertions to rewrite** (lines 120, 159, 169, 207):
```typescript
expect(res.body.requiresApproval).toBe(true);   // → expect(res.body.status).toBe("PENDING_APPROVAL");
...
expect(approveRes.body.requiresApproval).toBe(false); // → expect(approveRes.body.status).toBe("APPROVED");
...
expect(res.body.requiresApproval).toBe(false);  // → expect(res.body.status).toBe("APPROVED");
```
The stock-decrement assertions (lines 123-128, 171-175, 210-211 — checking `InventoryStock.quantityOnHand` and `StockTransaction` count before/after approve) are the exact pattern RESEARCH.md's Wave 0 Gaps flags for extending to directly verify APPROVAL-03 — keep these assertions as-is, they already test the right thing structurally, just also assert `status` alongside/instead of `requiresApproval`.

---

### `apps/backend/tests/importOrder.valueThreshold.test.ts` (NEW)

**Analog:** `apps/backend/tests/salesOrder.creditLimit.test.ts` (full structural mirror — same 3-test-case shape: over-threshold soft-block, approve-and-decrement, under-threshold immediate-approve) combined with `apps/backend/tests/creditDiscountGate.test.ts` for the pure-guard-function unit-test style if a unit-level test (not just integration) is also wanted for `assertImportValueThresholdTx`.

**What to copy:** the entire `beforeAll`/`afterAll` fixture-setup shape from `salesOrder.creditLimit.test.ts` (category/supplier/product/customer/license creation with `TEST_*_${Date.now()}` naming convention), swapped to import-order fixtures (no customer/license needed — just supplier + product), and the same 3-case structure:
1. `totalValue` over `IMPORT_ORDER_APPROVAL_THRESHOLD` → `status: "PENDING_APPROVAL"`, no `InventoryStock`/lot rows created yet (import orders create lots at RECEIVED, so this test should also assert `logisticsStatus` stays whatever was submitted — no premature lot creation).
2. Approve by a different `IMPORT_ORDER_APPROVE` holder → `status: "APPROVED"`, `approvedById`/`approvedAt` set.
3. Under-threshold → immediate `status: "APPROVED"` on create.

## Shared Patterns

### No-self-approval check
**Source:** `apps/backend/src/controllers/salesOrder.controller.ts` lines 175-180 (checks both `createdById` and `updatedById`); `apps/backend/src/controllers/importOrder.controller.ts` lines 178-180 (checks only `createdById` — no `updatedById` field on `ImportOrder` currently).
**Apply to:** `approveSalesOrder`, `rejectSalesOrder`, `approveImportOrder`, `rejectImportOrder` — reuse verbatim, unchanged, per CONTEXT.md "Carried Forward from Phase 3."
```typescript
if (existing.createdById != null && existing.createdById === req.userId) {
  throw new HttpError(403, "You cannot approve an order you created");
}
if (existing.updatedById != null && existing.updatedById === req.userId) {
  throw new HttpError(403, "You cannot approve an order you last edited");
}
```

### Permission gate (route-level)
**Source:** `apps/backend/src/routes/salesOrder.routes.ts` lines 19-20; `apps/backend/src/routes/importOrder.routes.ts` lines 19-20.
**Apply to:** No changes needed — already wired:
```typescript
salesOrderRoutes.post("/:id/approve", requireAuth, requirePermission("SALES_ORDER_APPROVE"), approveSalesOrder);
salesOrderRoutes.post("/:id/reject", requireAuth, requirePermission("SALES_ORDER_APPROVE"), rejectSalesOrder);
```

### Transaction-scoped guard composition (hard-reject then soft-block)
**Source:** `apps/backend/src/models/salesOrder.model.ts` lines 66-73 (`applyLotGuardsTx`).
**Apply to:** `importOrder.model.ts`'s new threshold wiring — keep hard checks (`assertProductsNotBlockedTx`, any future lot-equivalent for import) strictly before the soft threshold guard, never merge/reorder (Pitfall 3).

### AuditLogModel.record — before/after snapshot
**Source:** every controller action in both files, e.g. `apps/backend/src/controllers/salesOrder.controller.ts` lines 202-209.
**Apply to:** unchanged mechanism — continues to receive whatever `before`/`after` row shape results from the status-field split; no changes to the `AuditLogModel` itself needed.
```typescript
await AuditLogModel.record(tx, {
  entity: "SalesOrder",
  entityId: salesOrderId,
  action: "approve",
  userId: req.userId ?? null,
  before: existing,
  after: updated,
});
```

### Transaction-flexible model client type
**Source:** `apps/backend/src/models/salesOrder.model.ts` line 11 and `importOrder.model.ts` line 8.
**Apply to:** unchanged — both models keep `type Client = PrismaClient | Prisma.TransactionClient;` and the `"$transaction" in client ? client.$transaction((tx) => run(tx)) : run(client)` dual-mode wrapper (lines 143, 214, 225 in salesOrder.model.ts; 139, 203, 214 in importOrder.model.ts) exactly as-is.

## No Analog Found

None — every file in scope is either a modification of an existing file (self is the best analog) or a new file with a direct structural analog already identified above (`importValueGate.ts` ← `creditDiscountGate.ts`; `importOrder.valueThreshold.test.ts` ← `salesOrder.creditLimit.test.ts`).

## Metadata

**Analog search scope:** `apps/backend/prisma/schema.prisma`, `apps/backend/src/{controllers,models,utils,routes,middleware}/*.ts`, `apps/backend/prisma/seed.ts`, `apps/backend/tests/*.test.ts`
**Files scanned:** 7 fully read (schema.prisma, both controllers, both models, creditDiscountGate.ts, lotGate.ts) + permission.ts + route files (grep) + seed.ts (grep) + order.noSelfApproval.test.ts + salesOrder.creditLimit.test.ts
**Pattern extraction date:** 2026-09-16
