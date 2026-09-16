# Phase 4: Approval Workflow - Research

**Researched:** 2026-09-16
**Domain:** Backend order-state-machine refactor (Prisma/Express/TypeScript, MySQL) — no new external libraries
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Status Field Split (carried into schema design)**
- **D-01:** Add a new dedicated `status` column (enum: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED,
  CANCELLED) to both `SalesOrder` and `ImportOrder`, separate from existing logistics/delivery
  fields.
- **D-02:** `ImportOrder.status` (currently overloaded with STAGING/PENDING_APPROVAL/APPROVED/
  CUSTOMS_CLEARED/RECEIVED/ISSUE/REJECTED) is renamed to a logistics-only field (e.g.
  `logisticsStatus`) retaining only STAGING/CUSTOMS_CLEARED/RECEIVED/ISSUE — approval-related
  values move to the new `status` column. Phase 3's RECEIVED-gated stock-in logic
  (`ImportOrderModel`) must be re-pointed to read/write the renamed logistics field, not the new
  approval `status` field — verify this explicitly during planning/execution so the RECEIVED gate
  keeps working.
- **D-03:** `SalesOrder.deliveryStatus` keeps its existing values (PENDING/SHIPPING/DELIVERED/
  RETURNED/DAMAGED) minus the stray APPROVED/REJECTED values, which move to the new `status`
  column. `DELIVERY_STATUS_VALUES` / `DELIVERY_PIPELINE` in `salesOrder.controller.ts` need updating
  to drop APPROVED/REJECTED.
- Existing `SalesOrder.requiresApproval` boolean and `SalesOrder.approver` / `ImportOrder.approver`
  free-text fields are replaced by the new `status` enum plus a real `approvedById` (FK to `User`),
  `approvedAt`, and `rejectionReason` field — matching APPROVAL-04's requirement to record approver,
  timestamp, decision, and reason (not just a username string).

**DRAFT Semantics**
- **D-04:** DRAFT is not reachable through the current creation flow — order creation auto-routes
  directly to PENDING_APPROVAL (if the order trips the sales credit/discount threshold or the new
  import value threshold) or straight to APPROVED (stock deducts immediately in the same
  transaction) otherwise. No "save without submitting" UI/API exists and none is being added this
  phase. DRAFT remains a valid enum value reserved for future use (e.g. a multi-step order form) but
  is not produced by any current code path.

**Import Order Approval Trigger**
- **D-05:** An import order requires approval (routes to PENDING_APPROVAL) when its `totalValue`
  exceeds a configurable threshold — mirrors the sales order credit/discount threshold pattern from
  Phase 3 (`applyLotGuardsTx`-style guard function). Below threshold: auto-APPROVED on create, stock
  created immediately per Phase 3's RECEIVED-gated logic (approval and the RECEIVED logistics gate
  are independent checks — both must pass for stock to actually land: order must be APPROVED AND
  logistics status RECEIVED).
- Threshold value is Claude's discretion (planner should document the chosen default clearly and
  make it easy to find/tune, e.g. a named constant or config value) — not hardcoded without a
  comment explaining the number's origin.

**CANCELLED Semantics**
- **D-06:** CANCELLED is only reachable from DRAFT or PENDING_APPROVAL. An APPROVED order cannot be
  cancelled through this workflow (any correction after approval is a separate concern, out of
  scope for this phase — e.g. future return/refund flow). Because CANCELLED never applies to an
  order whose stock was already deducted, no stock-reversal logic is needed for cancellation.

**Carried Forward from Phase 3 (do not re-ask)**
- No-self-approval (ENFORCE-06) already checks both `createdById` and `updatedById` against the
  approver at the existing approve/reject endpoints — reuse as-is for both models' new `status`
  transitions.
- Sales order credit-limit/discount-limit threshold checks already exist
  (`applyLotGuardsTx`/threshold logic added in Phase 3) — this phase upgrades their *output* from
  the interim `requiresApproval` boolean to setting `status = PENDING_APPROVAL`, not rewriting the
  threshold logic itself.
- Manager/Approver permission gate (Phase 2's `requirePermission` middleware) already exists at the
  approve/reject endpoints — reuse directly; APPROVAL-06 requires no new permission-checking code,
  just applying the existing check to the newly separated `status` field.
- Per-line rounding (round-half-up, 2 decimals) — unaffected by this phase, no new price/discount
  math introduced.

### Claude's Discretion
- Exact import-order value threshold number and where it lives (named constant vs. env/config).
- Exact enum/column naming for the renamed import logistics field (e.g. `logisticsStatus` vs.
  `fulfillmentStatus`) — D-02's suggestion is a starting point, not a hard requirement.
- Whether `approvedById`/`approvedAt`/`rejectionReason` live directly on `SalesOrder`/`ImportOrder`
  or in a small shared approval-audit structure — as long as APPROVAL-04's fields are queryable per
  order.

### Deferred Ideas (OUT OF SCOPE)
- Real DRAFT/"save without submitting" step with an explicit submit action — noted as a possible
  future UX improvement but not built this phase (D-04).
- Cancelling an already-APPROVED order with stock reversal — deferred; treated as a future
  return/refund concern, not part of this phase's CANCELLED semantics (D-06).
- Multi-level (>1 tier) approval chains — out of scope for the whole milestone per PROJECT.md, not
  just this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| APPROVAL-01 | Import orders and sales orders support statuses DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, and CANCELLED | New `OrderStatus` Prisma enum + `status` column on both models (see Standard Stack, Code Examples: Prisma schema change) |
| APPROVAL-02 | An order in a non-APPROVED state does not affect final stock or delivery | Stock-decrement trigger moved from `!requiresApproval` to `status === APPROVED` (see Pattern 1, Anti-Patterns) |
| APPROVAL-03 | Stock is decremented at the point an order transitions to APPROVED, not at order creation | Same-transaction decrement at create-time-if-under-threshold, or at `/approve`-time-if-was-PENDING_APPROVAL (see System Architecture Diagram) |
| APPROVAL-04 | Approving or rejecting an order records the approver, timestamp, decision, and (if rejected) a reason | New `approvedById`/`approvedAt`/`rejectionReason` columns, written in approve/reject controller actions (see Don't Hand-Roll, Code Examples) |
| APPROVAL-05 | Orders exceeding credit limit or discount limit thresholds automatically require approval before proceeding | Existing `assertCreditAndDiscountTx` (sales) upgraded to drive `status`; new `assertImportValueThresholdTx` (import) mirrors it (see Pattern 1, Pattern 2) |
| APPROVAL-06 | A user with Manager/Approver permission can approve or reject a pending order; a user without that permission cannot | Existing `requirePermission("SALES_ORDER_APPROVE"/"IMPORT_ORDER_APPROVE")` + no-self-approval check, reused unchanged (see Don't Hand-Roll, Security Domain) |
</phase_requirements>

## Summary

This phase is a schema-and-controller refactor, not a new-technology adoption. Everything needed
already exists in the codebase from Phases 2-3: a `requirePermission` middleware gating
`SALES_ORDER_APPROVE`/`IMPORT_ORDER_APPROVE`, a no-self-approval check on `createdById`/`updatedById`,
a `requiresApproval` boolean on `SalesOrder` fed by `assertCreditAndDiscountTx` (soft-block, never
throws), and stock-decrement logic (`createStockOutTx`/`createOrUpdateLotsFromReceivingTx`) already
living inside the same Prisma transaction as order create/update. The work is: (1) add a Prisma enum
`OrderStatus` and a `status` column to both `SalesOrder` and `ImportOrder`; (2) rename
`ImportOrder.status` (currently overloaded) to a logistics-only field; (3) replace the
`requiresApproval` boolean + free-text `approver` string with `status` + `approvedById` (FK) +
`approvedAt` + `rejectionReason`; (4) move the stock-decrement trigger from "not `requiresApproval`"
to "status transitions to `APPROVED`"; (5) add an import-order value-threshold guard mirroring
`assertCreditAndDiscountTx`'s shape; (6) update every place that currently reads/writes
`deliveryStatus`/`status`/`approver`/`requiresApproval` for orders — controllers, seed, and a
significant slice of the existing Vitest suite that asserts on the old field names/values.

**Primary recommendation:** Do the schema migration first (Prisma enum + renamed columns, with a data
migration step for existing rows), then update both models' guard/transaction logic, then both
controllers, then seed.ts, then sweep every existing order test for the renamed fields — in that
order, because each later step depends on the previous one compiling.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Status enum validation & transitions | API/Backend (`*.controller.ts` transition validators) | Database (Prisma enum as defense-in-depth) | Business transition rules (e.g. CANCELLED only from DRAFT/PENDING_APPROVAL) are app logic; the enum type just prevents garbage values |
| Stock decrement on APPROVED | API/Backend (`*.model.ts`, inside `$transaction`) | Database (transaction atomicity) | Must be atomic with the status write — same pattern Phase 3 already established for lot decrement |
| Credit/discount/value threshold routing | API/Backend (`utils/*Gate.ts` guard functions) | — | Pure business-rule computation, no persistence concern of its own |
| Approver identity/timestamp/reason capture | API/Backend (approve/reject controller actions) | Database (new columns) | Write path is the controller; storage is just column additions |
| Permission gate (Manager/Approver) | API/Backend (`requirePermission` middleware, already exists) | — | Unchanged from Phase 2 — reused, not re-architected |
| Displaying status/rejection reason | Browser/Client (React pages) | — | Read-only reflection of backend state; no new business logic in the UI |

## Standard Stack

### Core
No new libraries. This phase uses only what's already in the stack:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Prisma | (existing, per `apps/backend/package.json`) | ORM, enum + migration support | Already used for `CustomerLicenseStatus`, `UserStatus`, `TransactionType` enums — same pattern applies to the new `OrderStatus` enum [VERIFIED: apps/backend/prisma/schema.prisma] |
| Express + existing middleware | (existing) | Routing, `requirePermission`, `requireAuth` | Reused verbatim, no change needed [VERIFIED: apps/backend/src/routes/salesOrder.routes.ts, importOrder.routes.ts] |
| Vitest + supertest | (existing) | Test framework | Already the phase 2/3 test stack [VERIFIED: apps/backend/vitest.config.ts, package.json "test": "vitest run"] |

**Installation:** None required — no new packages.

**Version verification:** Not applicable — no new dependencies introduced this phase.

## Architecture Patterns

### System Architecture Diagram

```
Client (React order form / approve-reject buttons)
        │  POST /api/sales-orders  or  /api/import-orders
        ▼
Controller (salesOrder.controller.ts / importOrder.controller.ts)
        │  parses body, validates transition shape (assertValidStatusTransition)
        ▼
Model.create/update (inside prisma.$transaction)
        │
        ├─> assertProductsNotBlockedTx (license gate — unchanged)
        ├─> assertLotQuantityTx (hard reject if lot insufficient — unchanged)
        ├─> assertCreditAndDiscountTx / assertImportValueThresholdTx (soft: returns routedStatus)
        │        │
        │        ├─ under threshold ──────────────► status = APPROVED
        │        │                                   └─> decrement stock NOW (same tx)
        │        └─ over threshold ───────────────► status = PENDING_APPROVAL
        │                                            └─> stock decrement DEFERRED
        ▼
Order row written with status, no approvedById/approvedAt yet (if PENDING_APPROVAL)
        │
        │  (later) POST /api/sales-orders/:id/approve  or  /reject
        ▼
Controller approve/reject action (inside prisma.$transaction)
        │  requirePermission("SALES_ORDER_APPROVE" | "IMPORT_ORDER_APPROVE")  [route middleware]
        │  no-self-approval check: createdById/updatedById !== req.userId
        ├─ approve ──► if status was PENDING_APPROVAL: decrement stock NOW (same tx as status write)
        │              write status=APPROVED, approvedById, approvedAt
        └─ reject  ──► write status=REJECTED, approvedById, approvedAt, rejectionReason
        ▼
AuditLogModel.record(before, after)  — unchanged mechanism from Phase 2
        ▼
Response reflects new status to client; ImportOrder.logisticsStatus (renamed field) is untouched by
this flow — RECEIVED-gated stock-IN (Phase 3) remains a fully independent check that must ALSO pass.
```

### Recommended Project Structure

No new folders. Changes land in existing files:

```
apps/backend/prisma/
├── schema.prisma          # add OrderStatus enum, status/approvedById/approvedAt/rejectionReason
│                           # columns; rename ImportOrder.status -> logisticsStatus (narrowed enum/values)
└── migrations/
    └── <timestamp>_phase4_approval_workflow/   # schema change + data backfill (see Code Examples)

apps/backend/src/
├── utils/
│   ├── creditDiscountGate.ts      # existing — change return shape (see Pattern 2 below)
│   └── importValueGate.ts         # NEW — mirrors creditDiscountGate.ts shape for ImportOrder
├── models/
│   ├── salesOrder.model.ts        # applyLotGuardsTx now returns status directly; stock-decrement
│   │                               # condition changes from !requiresApproval to status === APPROVED
│   └── importOrder.model.ts       # add threshold guard call; separate status vs logisticsStatus reads
├── controllers/
│   ├── salesOrder.controller.ts   # DELIVERY_STATUS_VALUES drops APPROVED/REJECTED; new
│   │                               # STATUS_VALUES + assertValidStatusTransition for the new field;
│   │                               # approve/reject write status/approvedById/approvedAt/rejectionReason
│   └── importOrder.controller.ts  # IMPORT_STATUS_VALUES splits into logistics values + the new
│                                   # shared OrderStatus values; same approve/reject rewrite
└── prisma/seed.ts                 # every ImportOrder/SalesOrder seed row needs status +
                                    # logisticsStatus/deliveryStatus split
```

### Pattern 1: Threshold guard returns the routed status directly (not a boolean)

**What:** Upgrade `assertCreditAndDiscountTx`'s return shape from `{ requiresApproval: boolean }` to
something the model can use directly to set `status`. Simplest upgrade path: keep the function
computing the same `overCredit || overDiscount` boolean, but have the **caller** (the model) map it
to `status: overLimit ? "PENDING_APPROVAL" : "APPROVED"` — this keeps the gate function itself
UI/enum-agnostic and easy to unit-test in isolation (existing `creditDiscountGate.test.ts` keeps
working with minimal changes).

**When to use:** Any threshold-based auto-routing (credit/discount for sales, value for import).

**Example:**
```typescript
// Source: apps/backend/src/utils/creditDiscountGate.ts (existing pattern, upgraded)
export const assertCreditAndDiscountTx = async (
  tx: Prisma.TransactionClient,
  customerId: number,
  items: CreditDiscountCheckItem[],
) => {
  // ... unchanged computation of overCredit / overDiscount ...
  return { requiresApproval: overCredit || overDiscount }; // keep as-is; map in the model:
};

// apps/backend/src/models/salesOrder.model.ts
const { requiresApproval } = await applyLotGuardsTx(tx, data.customerId, data.items);
const status: OrderStatus = requiresApproval ? "PENDING_APPROVAL" : "APPROVED";
// ... create order with status ...
if (status === "APPROVED") {
  await createStockOutTx(tx, data.orderNo, data.items); // moved trigger: status-based, not flag-based
}
```

### Pattern 2: New import-value threshold guard mirrors the sales pattern exactly

**What:** `assertImportValueThresholdTx(tx, totalValue)` — same shape as `assertCreditAndDiscountTx`:
takes `tx` plus the values needed, returns a soft signal, never throws. Threshold is a named constant
(Claude's discretion per CONTEXT.md D-05) — e.g. `IMPORT_ORDER_APPROVAL_THRESHOLD` in a small
`config/thresholds.ts` file with a comment explaining the number's origin (a placeholder business
rule until finance provides a real figure — document this explicitly, since no source document in
this repo specifies one: **[ASSUMED]**).

**When to use:** Import order create/update, in place of the "unconditionally APPROVED" behavior
today.

**Example:**
```typescript
// Source: pattern mirrors apps/backend/src/utils/creditDiscountGate.ts
export const IMPORT_ORDER_APPROVAL_THRESHOLD = 50_000; // [ASSUMED] placeholder pending finance input;
// tune here — single source of truth, referenced by importOrder.model.ts only.

export const assertImportValueThresholdTx = (totalValue: number) => ({
  requiresApproval: totalValue > IMPORT_ORDER_APPROVAL_THRESHOLD,
});
```

### Pattern 3: Status transition validator, split per concern

**What:** Two independent transition validators per order type: one for the new `status` enum
(DRAFT→PENDING_APPROVAL→APPROVED/REJECTED, plus CANCELLED only from DRAFT/PENDING_APPROVAL per D-06),
one for the existing logistics field (`deliveryStatus` for SalesOrder unchanged minus
APPROVED/REJECTED; `logisticsStatus` for ImportOrder, STAGING→CUSTOMS_CLEARED→RECEIVED/ISSUE, no
approval values). Keep them as two separate arrays/functions — do not try to unify, since the state
machines have different shapes (5-state single-tier approval vs. multi-step logistics pipeline).

**When to use:** `createSalesOrder`/`updateSalesOrder`/`createImportOrder`/`updateImportOrder`
controllers.

**Example:**
```typescript
// Source: apps/backend/src/controllers/salesOrder.controller.ts (existing DELIVERY_STATUS_VALUES
// pattern, split into two)
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

const DELIVERY_STATUS_VALUES = ["PENDING", "SHIPPING", "DELIVERED", "RETURNED", "DAMAGED"]; // APPROVED/REJECTED removed
```

### Anti-Patterns to Avoid
- **Trusting a client-submitted `status: "APPROVED"` on create:** Same anti-pattern already flagged in
  `creditDiscountGate.ts`'s comment — never let the client set `status` directly to `APPROVED` or
  `PENDING_APPROVAL`; always derive it server-side from the threshold guard. The existing controllers
  already block client-submitted `APPROVED`/`REJECTED` on create/update (lines 77-79 in
  `salesOrder.controller.ts`, 74-76 in `importOrder.controller.ts`) — extend that same block to the
  new `status` field, not just the old `deliveryStatus`/logistics field.
- **Conflating `status` and the logistics field in one column:** This is exactly the bug D-01/D-02
  fix. Do not special-case "if status is one of these 5 values treat it as approval, otherwise
  logistics" — that ambiguity is what caused the original design problem.
- **Decrementing stock outside the same `$transaction` as the status write:** Would reintroduce a race
  where an approval could be recorded but the decrement lost (or vice versa) on a crash between the
  two writes. Both existing `approveSalesOrder` and the model's create/update already do this
  correctly inside one transaction — preserve that.
- **Forgetting the RECEIVED-gate is now a second, independent check for ImportOrder:** After the
  rename, `logisticsStatus === "RECEIVED"` AND `status === "APPROVED"` must BOTH be true before
  `createOrUpdateLotsFromReceivingTx` fires. Gating on only one of the two re-introduces the Phase 3
  bug for a different reason (approval bypass) — this is the single highest-risk regression point in
  this phase (flagged in STATE.md Blockers/Concerns).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Order status enum + transition guard | A generic state-machine library | Plain TS array + function (as Phase 3 already does for `IMPORT_STATUS_PIPELINE`) | Single-tier, 5-state machine is too simple to justify a library; existing pattern is proven and consistent |
| Approver audit trail | A separate `ApprovalAudit` table/entity | Columns directly on `SalesOrder`/`ImportOrder` (`approvedById`, `approvedAt`, `rejectionReason`) plus the existing generic `AuditLog` table for the full before/after snapshot | CONTEXT.md leaves this to Claude's discretion but flags "as long as APPROVAL-04's fields are queryable per order" — inline columns are queryable with a plain `findUnique`/`findMany`, no extra join, and `AuditLog` already captures the full before/after history generically; a third table would duplicate what `AuditLog` already does |
| Permission check for approve/reject | New RBAC logic | Existing `requirePermission("SALES_ORDER_APPROVE"/"IMPORT_ORDER_APPROVE")` middleware, already wired at the route level | APPROVAL-06 explicitly requires no new permission-checking code per CONTEXT.md "Carried Forward from Phase 3" |

**Key insight:** Nearly everything APPROVAL-01..06 needs already exists in scaffolded form from
Phases 2-3 (interim flag, permission gate, no-self-approval, transaction-scoped guards). The actual
net-new code surface is small: one enum, four new/renamed columns, one new threshold guard function,
and rewiring the stock-decrement condition. The bulk of the *effort*, however, is in updating every
consumer of the old field names/values (controllers, seed, and — critically — a large slice of the
existing test suite), not in designing new mechanisms.

## Common Pitfalls

### Pitfall 1: Existing tests hard-code the old field/value names and will fail after the rename
**What goes wrong:** `order.noSelfApproval.test.ts` asserts `approveRes.body.deliveryStatus ===
"APPROVED"` and `approveRes.body.status === "APPROVED"` (for import) — both will still technically
pass IF the new `status` field also becomes `"APPROVED"` for import orders, but the SalesOrder
assertion on `deliveryStatus === "APPROVED"` will now be WRONG (deliveryStatus stays "PENDING" per
D-03; the new `status` field is what becomes "APPROVED"). Similarly `salesOrder.creditLimit.test.ts`
and `salesOrder.discountLimit.test.ts` assert on `res.body.requiresApproval` (a field being removed
entirely per D-01/D-02).
**Why it happens:** These tests were written for the Phase 3 interim mechanism, which this phase
explicitly upgrades/removes.
**How to avoid:** Treat "update every order.*/salesOrder.*/audit.crud.orders test that references
`deliveryStatus === APPROVED/REJECTED`, `requiresApproval`, or `ImportOrder.status` for approval
meaning" as an explicit task, not an afterthought. Grep for `requiresApproval`, `deliveryStatus ===
"APPROVED"`, `deliveryStatus === "REJECTED"`, and `body.status).toBe("APPROVED")` across `tests/`
before considering the phase done.
**Warning signs:** `npm test` (vitest run) failing on assertions in files not touched by this phase's
code changes — that's the tell that a field rename broke an unrelated-looking test.

### Pitfall 2: `assertValidImportStatusTransition`'s pipeline logic silently breaks once `status` is split from `logisticsStatus`
**What goes wrong:** The current `IMPORT_STATUS_PIPELINE` conflates approval states
(STAGING/PENDING_APPROVAL/APPROVED) with logistics states (CUSTOMS_CLEARED/RECEIVED/ISSUE) in one
ordered index. After D-02's rename, `logisticsStatus` should probably start directly at STAGING (no
PENDING_APPROVAL/APPROVED steps) — meaning the pipeline ordering needs to be redefined, not just
renamed. Reusing the old array with two entries deleted will misorder the remaining pipeline (indices
shift).
**Why it happens:** Easy to do a mechanical find-replace on the array without re-deriving the correct
new pipeline order.
**How to avoid:** Explicitly write out the new `LOGISTICS_STATUS_VALUES` / pipeline as
`["STAGING", "CUSTOMS_CLEARED", "RECEIVED", "ISSUE"]` with fresh indices, don't edit the old array
in place.
**Warning signs:** An import order transition that should be rejected (e.g. RECEIVED → STAGING) is
silently allowed because the index comparison uses stale numbers.

### Pitfall 3: Auto-APPROVED-on-create still needs the lot-quantity hard-check to run *before* the decrement
**What goes wrong:** If the threshold guard runs and returns `APPROVED`, and stock decrement then
fires unconditionally, forgetting to keep `assertLotQuantityTx` in front of it (as `applyLotGuardsTx`
already sequences today) reintroduces overselling for orders that don't need approval.
**Why it happens:** During refactor it's tempting to inline the threshold check and lose track of
which guard is hard-reject (`assertLotQuantityTx`) vs. soft-block (`assertCreditAndDiscountTx`).
**How to avoid:** Keep `applyLotGuardsTx`'s existing internal ordering (hard lot check first, soft
threshold check second) — it already documents this via comments (ENFORCE-02 vs
ENFORCE-03/ENFORCE-04). Don't reorder or merge the two checks into one function.
**Warning signs:** A sales order for more units than a lot has succeeds when it should 400.

### Pitfall 4: `ImportOrder.approver`/`SalesOrder.approver` string field removal breaks seed.ts and frontend forms that still write/read it
**What goes wrong:** `seed.ts` currently sets `approver: "Kumiko Sato (Manager)"` as free text for
~10 import order rows and ~4 sales order rows; the sales order create/edit form
(`SalesOrdersPage.tsx`) has a free-text `approver` input field the user can type into on create. If
`approver` (String) is dropped in favor of `approvedById` (Int FK), both of these break at compile/
runtime unless updated in the same phase.
**Why it happens:** The schema change is easy to isolate; every caller of the old field is not.
**How to avoid:** Grep `approver` across `apps/backend` and `apps/frontend` before removing the
column — decide explicitly whether to keep `approver` as a deprecated read-only display field
(unlikely, given CONTEXT.md explicitly says it's "replaced") or fully remove and update every
reference, including the create-order form (which should stop letting users set an approver at
order-creation time — approval only happens via the dedicated endpoint, consistent with D-04's DRAFT
semantics).
**Warning signs:** TypeScript compile errors in `SalesOrdersPage.tsx`/`ImportOrdersPage.tsx` after the
Prisma schema change; seed.ts throwing at `npx prisma db seed` time.

## Code Examples

### Prisma schema change (enum + column rename)
```prisma
// Source: pattern from apps/backend/prisma/schema.prisma existing enums (CustomerLicenseStatus, UserStatus)
enum OrderStatus {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  REJECTED
  CANCELLED
}

model SalesOrder {
  // ...existing fields...
  status         OrderStatus @default(APPROVED) @map("status")   // new
  approvedById   Int?        @map("approved_by_id")               // new, FK
  approvedAt     DateTime?   @map("approved_at")                  // new
  rejectionReason String?    @map("rejection_reason")              // new
  // requiresApproval Boolean — REMOVE
  // approver String? — REMOVE (or deprecate, see Pitfall 4)
  approvedBy     User?       @relation("ApprovedSalesOrders", fields: [approvedById], references: [id], onDelete: SetNull)
}

model ImportOrder {
  // ...existing fields...
  logisticsStatus String     @map("logistics_status") // renamed from `status`, narrowed value set
  status          OrderStatus @default(APPROVED) @map("status") // new column, same enum as SalesOrder
  approvedById    Int?        @map("approved_by_id")
  approvedAt      DateTime?   @map("approved_at")
  rejectionReason String?     @map("rejection_reason")
}
```

**Note on the rename collision:** `ImportOrder.status` (String) already exists — the new
`OrderStatus` enum column cannot reuse that name until the old column is renamed first. A two-step
Prisma migration (rename `status`→`logistics_status`, then add new `status` enum column) is required;
doing both in one migration file is fine as long as the SQL renames before it adds, in that order —
Prisma's `db push`/migration diff should handle this automatically if the schema is edited in two
logical stages before running `prisma migrate dev`, but verify the generated SQL does `RENAME COLUMN`
before `ADD COLUMN status`, not the reverse (a reverse order would collide on the column name mid-
migration on some MySQL versions). **[ASSUMED — verify generated migration SQL manually before
applying; not verified against this repo's actual MySQL version in this research session.]**

### Data migration for existing rows
```sql
-- Source: pattern — existing ImportOrder.status values map into the new split fields
-- Run as part of the same migration, after the schema changes above are applied.
UPDATE import_orders SET status = CASE
  WHEN logistics_status IN ('STAGING','PENDING_APPROVAL') THEN 'PENDING_APPROVAL'
  WHEN logistics_status IN ('APPROVED','CUSTOMS_CLEARED','RECEIVED') THEN 'APPROVED'
  WHEN logistics_status = 'REJECTED' THEN 'REJECTED'
  WHEN logistics_status = 'ISSUE' THEN 'APPROVED' -- ISSUE is a receiving-time flag, not an approval outcome
  ELSE 'APPROVED'
END;
UPDATE import_orders SET logistics_status = CASE
  WHEN logistics_status IN ('STAGING','PENDING_APPROVAL','APPROVED') THEN 'STAGING'
  WHEN logistics_status = 'REJECTED' THEN 'STAGING' -- rejected orders have no meaningful logistics state
  ELSE logistics_status -- CUSTOMS_CLEARED, RECEIVED, ISSUE pass through unchanged
END;

UPDATE sales_orders SET status = CASE
  WHEN delivery_status = 'APPROVED' THEN 'APPROVED'
  WHEN delivery_status = 'REJECTED' THEN 'REJECTED'
  WHEN requires_approval = 1 THEN 'PENDING_APPROVAL'
  ELSE 'APPROVED'
END;
UPDATE sales_orders SET delivery_status = 'PENDING' WHERE delivery_status IN ('APPROVED','REJECTED');
```
**[ASSUMED]** — this exact mapping is a reasonable inference from the seed data and existing status
semantics, but was not confirmed with the user. Flag for confirmation during planning/execution since
it determines what historical seed/demo data looks like post-migration (in particular, whether
`ISSUE` import orders should be `APPROVED` or something else, since `ISSUE` is really "a problem was
found after approval," not a rejection).

## Runtime State Inventory

This phase is a rename/refactor of persisted status fields, so a runtime-state check is warranted.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `sales_orders.delivery_status`, `sales_orders.requires_approval`, `sales_orders.approver`, `import_orders.status`, `import_orders.approver` — all currently hold live seeded rows (10 import orders, 8 sales orders per seed.ts) whose approval-related values must be reinterpreted into the new `status`/`logistics_status` split | Data migration (SQL above) required in addition to the schema/code changes — this is not just a code edit |
| Live service config | None — no external services (n8n, Datadog, etc.) reference these field names | None |
| OS-registered state | None — no scheduled tasks/services reference order status | None |
| Secrets/env vars | None directly; the new `IMPORT_ORDER_APPROVAL_THRESHOLD` constant is code, not a secret — but if the planner chooses an env var instead of a named constant, document the env var name in `.env.example` if one exists | Verify: `grep -rn "IMPORT_ORDER" apps/backend/.env* 2>/dev/null` returned nothing — confirms no existing env var to collide with |
| Build artifacts | Prisma client (`node_modules/.prisma/client`) is regenerated from schema.prisma on every `prisma generate` — stale generated types will cause compile errors referencing removed fields (`requiresApproval`, old `approver`) until regenerated | Run `npx prisma generate` immediately after the schema migration, before touching any `.ts` consumer files, so TypeScript errors correctly point at every remaining reference to the old fields |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `IMPORT_ORDER_APPROVAL_THRESHOLD` default value (50,000) and the claim that no source document specifies a real number | Pattern 2 / Code Examples | If a real threshold exists in one of the source docs (`liquor-system-improvement-advice.md`, Thai requirements doc) not re-checked in this session, the placeholder could contradict it — planner should grep those docs for an explicit import-order approval threshold before locking the constant |
| A2 | Data-migration mapping of old `ImportOrder.status`/`SalesOrder.deliveryStatus`+`requiresApproval` values onto the new split fields (especially `ISSUE` → `APPROVED`) | Code Examples (Data migration for existing rows) | Wrong mapping corrupts demo/seed data's approval history; low production risk (this is a demo system per repo name) but affects any manual QA relying on seed data looking "correct" |
| A3 | Prisma migration SQL ordering (rename before add) works cleanly on this project's MySQL version without a manual two-step migration | Code Examples (Note on the rename collision) | If wrong, `prisma migrate dev` could fail or produce an incorrect migration requiring manual SQL editing — moderate risk, easily caught at migration-generation time (fails loudly, not silently) |
| A4 | `approver` (free-text String) fields should be fully removed rather than kept as a deprecated display column | Pitfall 4 | If the user actually wants free-text `approver` retained for historical/legacy display alongside the new `approvedById` FK, removing it outright is a scope overreach; CONTEXT.md says "replaced," which supports removal, but the exact removal-vs-deprecate choice wasn't explicitly re-confirmed against every consumer in this research pass |

## Open Questions

1. **(RESOLVED) Should `ImportOrder.logisticsStatus` allow a `PENDING` initial value distinct from `STAGING`, or does `STAGING` remain the sole pre-customs value?**
   - What we know: D-02 says the renamed field retains "only STAGING/CUSTOMS_CLEARED/RECEIVED/ISSUE."
   - What's unclear: Whether `STAGING` is meant to be the universal starting logistics state regardless of `status` (DRAFT/PENDING_APPROVAL/APPROVED), or whether an import order not yet approved should have some other logistics placeholder.
   - Recommendation: Default `logisticsStatus` to `STAGING` for every new import order regardless of approval `status` (consistent with D-05's note that approval and RECEIVED-gating are independent checks) — this is the simplest interpretation and matches the data-migration mapping above.
   - Resolution: Planner confirmed the client continues to supply `logisticsStatus` on create (unchanged, defaults to `STAGING`) — the plans implement this default regardless of approval `status`, per the recommendation above.

2. **(RESOLVED) Exact wording/shape for the frontend's approve/reject UI reflecting `rejectionReason` and `approvedById` → display name**
   - What we know: CONTEXT.md's `<specifics>` section says no new UI screens, existing approve/reject actions just need to reflect new values.
   - What's unclear: Whether the existing free-text `approver` display column in `SalesOrdersPage.tsx`/`ImportOrdersPage.tsx` tables should be replaced with a joined `approvedBy.username`, and whether a reject reason needs a new input field in the UI (currently `reason` is only accepted via API body, per `order.noSelfApproval.test.ts`'s reject calls with `{ reason: "..." }` — but no visible UI form was found in `SalesOrdersPage.tsx`/`ImportOrdersPage.tsx` for entering it).
   - Recommendation: Planner should grep both pages for an existing reject-reason input; if none exists, adding a minimal reason `<textarea>` on the reject action is in-scope per APPROVAL-04's literal requirement ("records ... a reason when rejected"), even though CONTEXT.md frames this phase as "backend-only."
   - Resolution: No existing reject-reason input was found (confirmed) — 04-06-PLAN.md Task 5 adds Approve/Reject buttons on PENDING_APPROVAL rows plus a reason `<textarea>` prompt for reject, calling the real approve/reject API endpoints (gated client-side by SALES_ORDER_APPROVE/IMPORT_ORDER_APPROVE for UX only; backend remains the enforcement point).

## Environment Availability

No external tool/service dependencies introduced by this phase (pure schema + TypeScript + existing
MySQL/Prisma stack). Skipping per the skip condition in the research protocol.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest [VERIFIED: apps/backend/package.json `"test": "vitest run"`, apps/backend/vitest.config.ts] |
| Config file | `apps/backend/vitest.config.ts` |
| Quick run command | `npx vitest run tests/order.noSelfApproval.test.ts tests/salesOrder.creditLimit.test.ts tests/salesOrder.discountLimit.test.ts` |
| Full suite command | `npm test` (from `apps/backend`) → `vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| APPROVAL-01 | SalesOrder/ImportOrder support 5-value `status` enum | unit/integration | `npx vitest run tests/salesOrder.creditLimit.test.ts` (needs update) | ✅ existing (needs rewrite) |
| APPROVAL-02 | Non-APPROVED order has no stock/delivery effect | integration | `npx vitest run tests/salesOrder.creditLimit.test.ts tests/salesOrder.discountLimit.test.ts` | ✅ existing (needs rewrite for status field) |
| APPROVAL-03 | Stock decremented exactly at APPROVED transition | integration | new test asserting `InventoryStock.quantityOnHand` unchanged at PENDING_APPROVAL, decremented after `/approve` | ❌ Wave 0 — extend `salesOrder.creditLimit.test.ts`'s existing decrement assertions (lines ~120-169 per grep) rather than a new file |
| APPROVAL-04 | Approve/reject records approver, timestamp, decision, reason | integration | new assertions in `order.noSelfApproval.test.ts` (already exercises approve/reject) checking `approvedById`/`approvedAt`/`rejectionReason` in response body | ❌ Wave 0 — extend existing file |
| APPROVAL-05 | Credit/discount/import-value threshold auto-routes to PENDING_APPROVAL | integration | `npx vitest run tests/salesOrder.creditLimit.test.ts tests/salesOrder.discountLimit.test.ts` + new `importOrder.valueThreshold.test.ts` | ⚠️ sales side exists (needs rewrite); import side ❌ Wave 0 |
| APPROVAL-06 | Manager/Approver can approve/reject; non-holder is rejected | integration | `npx vitest run tests/rbac.enforcement.writes.orders.test.ts tests/order.noSelfApproval.test.ts` | ✅ existing — `rbac.enforcement.writes.orders.test.ts` likely already covers the permission-denied path for approve/reject; confirm during planning it isn't asserting on now-removed fields |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test files>`
- **Per wave merge:** `npm test` (from `apps/backend`) — full suite, since this phase touches shared
  field names referenced by many unrelated-looking test files (audit, rbac, license-block tests all
  create sales/import orders as fixtures)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/importOrder.valueThreshold.test.ts` — covers APPROVAL-05 for import orders (new threshold
  guard has no existing test analog; `creditDiscountGate.test.ts` is the closest pattern to mirror)
- [ ] Extend `tests/order.noSelfApproval.test.ts` — add assertions for `approvedById`/`approvedAt`/
  `rejectionReason` fields (APPROVAL-04), since it already has approve/reject flows wired
- [ ] Extend `tests/salesOrder.creditLimit.test.ts` and `tests/salesOrder.discountLimit.test.ts` —
  update `requiresApproval` assertions to `status === "PENDING_APPROVAL"`/`"APPROVED"`, and add an
  explicit `InventoryStock.quantityOnHand` check before/after `/approve` to directly verify APPROVAL-03
  (currently these tests check for absence of a stock transaction, not the enum-driven trigger point)
- [ ] Audit every file under `apps/backend/tests/` for literal references to `requiresApproval`,
  `deliveryStatus === "APPROVED"`, `deliveryStatus === "REJECTED"`, or `ImportOrder.status` used with
  approval semantics — this list could not be fully enumerated in this research pass (grep found at
  least `order.noSelfApproval.test.ts`, `salesOrder.creditLimit.test.ts`,
  `salesOrder.discountLimit.test.ts`, `creditDiscountGate.test.ts`; `audit.crud.orders.test.ts` and
  `rbac.enforcement.writes.orders.test.ts` should also be checked since they create orders as fixtures)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged from Phase 1) | — |
| V3 Session Management | no (unchanged) | — |
| V4 Access Control | yes | `requirePermission("SALES_ORDER_APPROVE"/"IMPORT_ORDER_APPROVE")` middleware (existing, reused) + no-self-approval check on `createdById`/`updatedById` (existing, reused) — both must continue to gate the newly separated `status` field, not the old `deliveryStatus`/`status` fields |
| V5 Input Validation | yes | Status-transition validators (`assertValidOrderStatusTransition` etc.) reject invalid enum values and invalid transitions server-side, independent of what the client UI allows |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client submits `status: "APPROVED"` directly on order create/update to bypass the approve/reject endpoint's permission check and no-self-approval check | Elevation of Privilege | Controller-level block (already exists for `deliveryStatus`/`status` = APPROVED/REJECTED on create/update; must be extended to the new `status` field) — never allow the create/update path to set a terminal approval state |
| A user with edit (not approve) permission edits an order's total/discount after it was routed to PENDING_APPROVAL, then a legitimate approver approves without re-checking thresholds | Tampering | The existing pattern already re-derives thresholds server-side from submitted items on every update (`creditDiscountGate.ts` comment: "never trust a client-computed total") — confirm the approve action itself does not re-run the threshold check (it shouldn't need to, since update already re-computes `status` on every edit; approve just finalizes whatever `status` was last computed) |
| Self-approval via a second account under the same user's control, or via `updatedById` reset by re-editing after approval-blocking edit | Repudiation / Elevation of Privilege | Already covered by existing no-self-approval check on both `createdById` and `updatedById` — no new work needed, just don't regress it during the field rename |

## Sources

### Primary (HIGH confidence)
- `apps/backend/prisma/schema.prisma` — current `SalesOrder`, `ImportOrder`, `User`, existing enum
  patterns (`CustomerLicenseStatus`, `UserStatus`, `TransactionType`)
- `apps/backend/src/controllers/salesOrder.controller.ts`, `importOrder.controller.ts` — current
  status-transition logic, approve/reject actions
- `apps/backend/src/models/salesOrder.model.ts`, `importOrder.model.ts` — current stock-decrement
  triggers, `applyLotGuardsTx`
- `apps/backend/src/utils/creditDiscountGate.ts`, `lotGate.ts` — existing guard-function shape to
  mirror
- `apps/backend/src/middleware/permission.ts`, `apps/backend/src/routes/salesOrder.routes.ts`,
  `importOrder.routes.ts` — existing permission gates, confirmed `SALES_ORDER_APPROVE`/
  `IMPORT_ORDER_APPROVE` already wired
- `apps/backend/prisma/seed.ts` — confirmed current seed data shape for both order types, role/
  permission seed rows for `MANAGER_APPROVER`
- `apps/backend/tests/order.noSelfApproval.test.ts`, `salesOrder.creditLimit.test.ts`,
  `salesOrder.discountLimit.test.ts`, `creditDiscountGate.test.ts` — confirmed existing test
  coverage and exact assertions that will need updating
- `.planning/phases/04-approval-workflow/04-CONTEXT.md` — locked decisions (D-01 through D-06)
- `.planning/phases/03-backend-enforcement-lot-batch-stock-control/03-CONTEXT.md` — prior-phase
  precedent this phase upgrades
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md` — requirement text, cross-phase risk flag

### Secondary (MEDIUM confidence)
None — no WebSearch was needed; this phase is entirely internal-codebase refactor work with no new
external technology decisions.

### Tertiary (LOW confidence)
- Import-order approval threshold default value (50,000) — no source found in this repo specifying a
  real number; flagged as `[ASSUMED]` in Assumptions Log A1.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries; every pattern verified directly against existing repo code
- Architecture: HIGH - directly derived from reading the actual current controllers/models/schema
- Pitfalls: HIGH for the field-rename/test-breakage risks (directly observed via grep); MEDIUM for the
  exact Prisma migration SQL ordering behavior (reasoned from Prisma/MySQL general behavior, not
  executed in this session)

**Research date:** 2026-09-16
**Valid until:** 30 days (stable internal codebase, no external API drift risk) — but re-verify
against the actual code state if Phase 3 work changes further before Phase 4 planning begins, since
this research assumes Phase 3's schema/controllers are in the state read during this session.
