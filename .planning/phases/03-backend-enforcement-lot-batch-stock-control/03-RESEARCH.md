# Phase 3: Backend Enforcement & Lot/Batch Stock Control - Research

**Researched:** 2026-09-15
**Domain:** Node/Express/Prisma backend — transactional business-rule enforcement, lot-level inventory
**Confidence:** HIGH (codebase-verified; this phase extends existing, working patterns rather than
introducing new technology)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Lot Selection & Sourcing
- **D-01:** `SalesOrderItem.lotBatch` (currently a free-text string, no relational integrity) becomes
  a real FK to `InventoryStock` (`inventoryStockId`). Creating/updating a sales order validates the
  selected lot has sufficient `quantityOnHand` and decrements it in the same transaction (mirrors the
  existing `Product.stockQty` pattern in `stockTransaction.model.ts`, applied one level down).
- **D-02:** The backend auto-suggests the oldest available lot for a product (FIFO by `receivedDate`)
  when a sales order line is created, but sales staff can override to a different lot if more than one
  exists for that product. Not FIFO-forced.
- **D-03:** Deleting or editing a sales order restores the previous lot's quantity before applying the
  new quantity/lot — same reverse-then-reapply pattern already used for `Product.stockQty` via
  `reverseAndDeleteByReferenceTx` in `stockTransaction.model.ts`; extend that same function (or a
  lot-aware sibling) to also touch `InventoryStock.quantityOnHand`.

#### Import Receiving to Lot Creation
- **D-04:** `InventoryStock` lots (and the corresponding stock-IN `StockTransaction`) are created only
  when an import order's status is set to (or transitions to) `RECEIVED` — not at order creation as
  today. This closes a real bug: `ImportOrderModel.create()` currently fires stock-IN unconditionally
  regardless of status, so an order sitting at `STAGING`/`PENDING_APPROVAL` already counts as received
  stock. Matches the PDF's distinct "Warehouse Receiving" step (separate from "Purchase Order
  Creation") and Thai requirements doc FR-13 (record actual received qty vs. ordered, alert on
  mismatch).
- Lot/batch numbering: derive from `{orderNo}-{itemIndex}` (same pattern as existing
  `transactionNo` generation in `stockTransaction.model.ts`) unless the receiving flow captures an
  explicit lot/batch number from the user — planner/researcher to confirm during implementation
  whether receiving captures a real lot number or auto-generates one; either is acceptable, prefer
  auto-generated with an optional override field if cheap to add.

#### Credit & Discount Limit Enforcement (interim, ahead of Phase 4)
- **D-05:** A sales order that would push `Customer.currentBalance` over `Customer.creditLimit`, or
  whose discount exceeds `Customer.standardDiscount`, is not hard-rejected. Instead it's flagged with
  a minimal "requires approval" indicator (a boolean or lightweight status field — planner's
  discretion on exact schema shape) that blocks the order's stock deduction until a user with
  `SALES_ORDER_APPROVE` permission (Manager/Approver role) approves it via the existing Phase 2
  approve endpoint. Phase 4 replaces this flag with the full DRAFT/PENDING_APPROVAL/APPROVED/etc.
  status machine — this interim mechanism should be structured so Phase 4 can upgrade it without
  throwing away the credit/discount threshold-check logic itself, only the state representation.
- No-self-approval (ENFORCE-06) already exists at the Phase 2 approve/reject endpoints (reject if
  requester is the order's `createdBy`) — this phase's interim approval flag reuses that same
  endpoint/check, no new no-self-approval logic needed here.

#### Stock-Adjustment Reason Codes
- **D-06:** Manual `InventoryStock.quantityOnHand` edits are blocked at the model layer (no direct
  CRUD update to that field). Corrections go through a new audited stock-adjustment action with a
  fixed reason code: `DAMAGE`, `THEFT`, `RECOUNT`, `EXPIRY`, `CORRECTION`, `OTHER` (plus a free-text
  note field for detail). Uses the existing Phase 2 audit-log mechanism (before/after snapshot).
- Permission: gate the stock-adjustment action behind a Warehouse & Distribution Officer-level
  permission (matches PDF Section 11's role table: Warehouse Staff -> receiving/shipping/inventory),
  reusing Phase 2's `requirePermission` pattern.

#### Rounding (carried forward — already resolved, do not re-ask)
- Per-line rounding, standard round-half-up to 2 decimals; sum lines for totals. Matches Thai VAT
  invoice convention. Resolved 2026-09-14, applies to any new price/discount/tax math this phase
  introduces (e.g. credit/discount threshold comparisons).

### Claude's Discretion
- Exact schema shape of the interim "requires approval" flag (boolean field vs. small enum) — D-05
  leaves this to the planner, as long as it's structured for a clean Phase 4 upgrade.
- Whether import-order receiving captures an explicit lot/batch number or auto-generates one from
  `orderNo` — D-04's numbering note leaves room for either.
- HTTP verb/endpoint shape for the new stock-adjustment action.

### Deferred Ideas (OUT OF SCOPE)
- Full approval status machine (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED) — Phase 4, per
  roadmap; this phase's interim flag (D-05) is explicitly a placeholder for it
- Landed cost (freight/insurance/customs fees) allocation — Phase 5, already resolved (allocate by
  value) per memory `project-open-decisions-resolved`
- Multi-branch/warehouse structure — deferred until a real second site exists (Phase 7 scope note);
  `InventoryStock.warehouse` stays a plain string this phase too
- Document generation (picking list, receiving report) — Phase 6
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ENFORCE-01 | Backend rejects a sales order if the customer's liquor license is expired, revoked, suspended, or missing | Already partially implemented via `validateAndSnapshotLicense`/`isLicenseValid` in `salesOrder.model.ts` — verify coverage of revoked/suspended/missing cases, not just expired; see Common Pitfalls / Sources |
| ENFORCE-02 | Backend rejects a sales order line that exceeds the selected lot/batch's available quantity | New `assertLotQuantityTx` guard modeled on `assertProductsNotBlockedTx`; see Architecture Pattern 1 |
| ENFORCE-03 | Backend rejects a sales order that exceeds the customer's credit limit unless routed through approval | New `assertCreditAndDiscountTx` guard + `requiresApproval` flag (D-05); see Architecture Pattern 4 |
| ENFORCE-04 | Backend requires approval when a discount exceeds the customer's allowed discount limit | Same guard as ENFORCE-03; see Architecture Pattern 4 |
| ENFORCE-05 | Backend rejects negative quantities, invalid prices, invalid discounts, and invalid status transitions with a clear error message | Extend controller-level `parseItems` validation; see Security Domain V5 |
| ENFORCE-06 | A user cannot approve a transaction they created or last edited, regardless of role combination | Partially implemented (createdById check); "last edited" clause is an Open Question — see Open Questions #2 and Common Pitfalls #4 |
| STOCK-01 | `InventoryStock` is the source of truth for stock quantity; product-level stock is derived/synced, not maintained independently | See Open Question #1 (sync vs. computed) and Architecture Patterns |
| STOCK-02 | Creating a sales order decreases the selected lot's on-hand quantity within the same transaction | Extend `createStockTransactionTx`/`createStockOutTx` one level down to `InventoryStock`; see Architecture Pattern 2 |
| STOCK-03 | Deleting or editing a sales order restores the previous lot quantity before applying the new quantity | Extend `reverseAndDeleteByReferenceTx`; see Architecture Pattern 2 code sketch |
| STOCK-04 | Import receiving creates or updates inventory lots with received quantity, warehouse, received date, and lot/batch number | New `createOrUpdateLotsFromReceivingTx`, gated on `status === RECEIVED`; see Architecture Diagram (import flow) and Common Pitfalls #2 |
| STOCK-05 | Stock transactions reference product, lot/batch, source document, and movement type | Requires new `StockTransaction.inventoryStockId` column; see Common Pitfalls #1 |
| STOCK-06 | Manual stock quantity edits are not permitted directly; corrections require an audited stock-adjustment transaction with a reason code | Remove `quantityOnHand` from `updateInventoryStock`'s writable fields; add new adjustment endpoint reusing `AuditLogModel`; see Don't Hand-Roll and Security Domain V4 |

</phase_requirements>

## Summary

This phase does not require any new library, framework, or architectural pattern — it requires
extending four already-established patterns in `apps/backend/src` one level deeper (from
`Product.stockQty` down to `InventoryStock.quantityOnHand`), and closing gaps between what the
**frontend currently fakes client-side** (credit/discount/approval checks) and what the **backend
currently does not enforce at all**. The codebase already has: a transaction-scoped stock
create/reverse pattern (`stockTransaction.model.ts`), a transaction-scoped guard-function pattern
(`licenseGate.ts`), a `Client = PrismaClient | Prisma.TransactionClient` polymorphic-client pattern
used consistently across all order models, a working no-self-approval check at the approve/reject
controllers, and a full audit-log mechanism. Phase 3's job is almost entirely "wire these together
one layer down and add the missing guard functions" rather than build new infrastructure.

The single most consequential finding: **`SalesOrdersPage.tsx` already renders a lot-selection
`<select>` populated from `InventoryStock` records showing `quantityOnHand` and `warehouse`**, but
it submits the lot's `lotBatch` *string* rather than its `inventoryStockId`. Converting
`SalesOrderItem.lotBatch` to a real FK (D-01) is consequently not just a schema change — the sales
order create/update payload shape changes, and the frontend must send `inventoryStockId` instead of
`lotBatch`. This must appear as an explicit task in the plan, not an incidental side effect. A second
consequential finding: the frontend's `validation.needsApproval` warning logic (credit-limit and
discount overage) is **cosmetic only** — it computes a warning and blocks the *frontend* submit
button unless `form.approver` (a free-text input, not permission-gated) is non-empty. This is exactly
the backend-enforcement gap ENFORCE-03/04 must close: any caller hitting the API directly bypasses
this entirely today.

**Primary recommendation:** Extend `stockTransaction.model.ts`'s `createStockTransactionTx` /
`reverseAndDeleteByReferenceTx` pair to also decrement/restore `InventoryStock.quantityOnHand` (keyed
by the new `inventoryStockId` FK), add three new transaction-scoped guard functions in the style of
`assertProductsNotBlockedTx` (lot-quantity guard, credit-limit guard, discount-limit guard), gate
import-order stock-IN creation behind `status === "RECEIVED"`, and add a dedicated
`POST /api/inventory-stock/:id/adjust` endpoint (or sibling) for D-06 instead of allowing
`PUT /api/inventory-stock/:id` to touch `quantityOnHand` directly.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| License validity check (ENFORCE-01) | API / Backend | — | Already implemented in `salesOrder.model.ts` via `isLicenseValid`; must remain backend-authoritative regardless of caller |
| Lot quantity validation & decrement (ENFORCE-02, STOCK-02/03) | API / Backend | Database (unique constraint safety net) | Must happen inside the same `$transaction` as order create/update to avoid race conditions between check and decrement |
| Credit/discount limit check (ENFORCE-03/04) | API / Backend | Frontend (advisory only) | Frontend already shows a warning; that warning is not a security boundary — backend must independently re-derive and enforce |
| Approval gating (interim flag, D-05) | API / Backend | — | New field on `SalesOrder`; existing Phase 2 approve endpoint becomes the unlock mechanism |
| Import receiving → lot creation (STOCK-04) | API / Backend | — | Gated on `ImportOrder.status` transition, computed server-side, not client-triggered |
| Stock-adjustment audit trail (STOCK-06) | API / Backend | Database (audit_logs table) | Reuses Phase 2's `AuditLogModel.record`; no new audit infrastructure needed |
| Manual InventoryStock edit blocking (D-06) | API / Backend | — | Enforced by removing `quantityOnHand` from the generic `updateInventoryStock` controller's writable fields |

## Standard Stack

No new packages are required for this phase. Confirmed current versions in the repo:

| Library | Version (installed) | Purpose | Source |
|---------|---------|---------|--------|
| `@prisma/client` / `prisma` | 6.19.3 (package.json pins `^6.4.1`) | ORM, `$transaction`, migrations | `[VERIFIED: npx prisma -v]` |
| `vitest` | ^2.1.8 | Test runner (already used for all backend tests) | `[VERIFIED: package.json]` |
| `supertest` | ^7.0.0 | HTTP-level integration tests against `app` | `[VERIFIED: package.json]` |
| `@node-rs/argon2` | (existing) | Test-user password hashing in fixtures | `[VERIFIED: tests/fixtures/testUser.ts]` |
| `express` | (existing) | HTTP framework | `[VERIFIED: routes/controllers pattern]` |

### Alternatives Considered
None — this is a pure extension of the existing stack. Introducing a new library (e.g. a rules
engine for credit/discount checks) would be over-engineering for two threshold comparisons; a plain
guard function matching `licenseGate.ts`'s shape is the appropriate scope.

**Installation:** None required.

**Version verification:** `npx prisma -v` run in `apps/backend` confirms Prisma 6.19.3 is installed
and matches the `^6.4.1` semver range in `package.json`. No upgrade needed.

## Architecture Patterns

### System Architecture Diagram

```
Caller (Frontend form OR direct API client)
        │
        ▼
  Express route (requireAuth → requirePermission("SALES_ORDER_CREATE"))
        │
        ▼
  Controller (parses/validates shape, opens prisma.$transaction)
        │
        ▼
  prisma.$transaction(tx => {
        │
        ├─► assertProductsNotBlockedTx(tx, productIds)         [existing: license/permit gate]
        │
        ├─► validateAndSnapshotLicense(tx, customerId, ...)    [existing: customer license gate]
        │
        ├─► NEW: assertLotQuantityTx(tx, items)                [ENFORCE-02: per-line lot check]
        │        └─ throws HttpError(400) if quantity > InventoryStock.quantityOnHand
        │
        ├─► NEW: assertCreditAndDiscountTx(tx, customer, items)[ENFORCE-03/04: threshold check]
        │        └─ sets requiresApproval flag instead of throwing (D-05: soft-block, not reject)
        │
        ├─► SalesOrder.create / .update (Prisma write)
        │
        ├─► NEW: decrementLotsTx(tx, items)                    [STOCK-02: same-tx decrement]
        │        └─ extends createStockTransactionTx one level down to InventoryStock
        │
        └─► AuditLogModel.record(tx, {...})                    [existing: Phase 2 audit]
  })
        │
        ▼
  Response (201/200, or 400/403 HttpError — same regardless of whether caller was
            the React frontend or curl/Postman)
```

Import-order receiving flow (STOCK-04, D-04):
```
ImportOrder.create (status = STAGING, e.g.)
        │  NO stock-IN fires here anymore (bug fix per D-04)
        ▼
ImportOrder.update (status → RECEIVED)
        │
        ▼
  NEW: createOrUpdateLotsFromReceivingTx(tx, importOrder)
        ├─ for each ImportOrderItem: create InventoryStock row
        │    (productId, importOrderItemId, lotBatch, receivedDate, quantityOnHand, warehouse)
        └─ createStockTransactionTx(tx, { type: IN, ... })     [existing pattern, reused]
```

### Recommended Project Structure
No new top-level folders needed — all changes land in existing files:
```
apps/backend/
├── prisma/schema.prisma           # SalesOrderItem.lotBatch → inventoryStockId FK;
│                                   # SalesOrder.requiresApproval (or similar) field;
│                                   # InventoryStock gets no new fields for D-01–D-04;
│                                   # new StockAdjustment model OR TransactionType enum value
├── src/utils/
│   ├── licenseGate.ts              # existing — model to follow
│   ├── stockReference.ts           # existing — reuse for lot numbering if auto-generated
│   ├── lotGate.ts                  # NEW: assertLotQuantityTx, lot FIFO-suggestion helper
│   └── creditDiscountGate.ts       # NEW: assertCreditAndDiscountTx
├── src/models/
│   ├── stockTransaction.model.ts   # extend create/reverse to touch InventoryStock too
│   ├── salesOrder.model.ts         # wire in lotGate + creditDiscountGate
│   ├── importOrder.model.ts        # gate stock-IN behind status===RECEIVED
│   └── inventoryStock.model.ts     # NEW: adjustStockTx (D-06 reason-coded adjustment)
├── src/controllers/
│   └── inventoryStock.controller.ts # remove quantityOnHand from updateInventoryStock's
│                                     # writable fields; add adjustInventoryStock controller
└── prisma/seed.ts                  # adjust seeded ImportOrder rows so only RECEIVED-status
                                     # rows produce InventoryStock/StockTransaction rows
```

### Pattern 1: Transaction-scoped guard function (existing — extend, don't replace)
**What:** A standalone async function taking `(tx: Prisma.TransactionClient, ...args)` that throws
`HttpError` on violation and returns void/data on success. Called from within the model's
`$transaction` closure before the mutating write.
**When to use:** Any new business-rule check this phase adds (lot quantity, credit limit, discount
limit).
**Example:**
```typescript
// Source: apps/backend/src/utils/licenseGate.ts (existing code, verified in this session)
export const assertProductsNotBlockedTx = async (tx: Prisma.TransactionClient, productIds: number[]) => {
  const uniqueIds = [...new Set(productIds)].filter((id) => Number.isFinite(id));
  if (uniqueIds.length === 0) return;
  const licenses = await tx.license.findMany({ where: { productId: { in: uniqueIds } } });
  for (const license of licenses) {
    const { status } = computePermitStatus(license.expiryDate);
    if (status === "EXPIRED") {
      throw new HttpError(400, `Product ${license.productId} has an expired permit ...`);
    }
  }
};
```
A new `assertLotQuantityTx(tx, items: { inventoryStockId: number; quantity: number }[])` should
follow this exact shape: fetch the relevant `InventoryStock` rows in one query, loop, throw
`HttpError(400, ...)` with a message mentioning the lot and available quantity (tests grep for
lowercase substrings like `"insufficient"` — match `stockTransaction.model.ts`'s existing wording
style: `Insufficient stock for {name}: requested {qty}, available {qty}`).

### Pattern 2: Reverse-then-reapply for edit/delete (existing — extend one level down)
**What:** `reverseAndDeleteByReferenceTx` finds all `StockTransaction` rows for a `referenceNo`,
reverses their effect on `Product.stockQty`, then deletes them. `SalesOrderModel.update` calls this
before recreating the order's items and stock transactions.
**When to use:** D-03 requires the same pattern for `InventoryStock.quantityOnHand`. The simplest
correct extension: since `StockTransaction` will (after D-01) carry enough info to know which lot it
touched (see STOCK-05 below — add an `inventoryStockId` column to `StockTransaction` itself, not just
to `SalesOrderItem`), `reverseAndDeleteByReferenceTx` can restore `InventoryStock.quantityOnHand` in
the same loop it already uses to restore `Product.stockQty`, keyed off `transaction.inventoryStockId`
when present (import-order stock-IN transactions won't always have one until D-04's lot creation, so
this field should be nullable).
**Example (extension sketch — not yet in codebase):**
```typescript
export async function reverseAndDeleteByReferenceTx(tx: Prisma.TransactionClient, referenceNo: string) {
  const existing = await tx.stockTransaction.findMany({ where: { referenceNo } });
  for (const transaction of existing) {
    await tx.product.update({
      where: { productId: transaction.productId },
      data: { stockQty: { increment: -stockDelta(transaction.transactionType, transaction.quantity) } },
    });
    if (transaction.inventoryStockId != null) {
      await tx.inventoryStock.update({
        where: { inventoryStockId: transaction.inventoryStockId },
        data: { quantityOnHand: { increment: -stockDelta(transaction.transactionType, transaction.quantity) } },
      });
    }
  }
  await tx.stockTransaction.deleteMany({ where: { referenceNo } });
}
```

### Pattern 3: Polymorphic `Client` type for composable transactions
**What:** Every model file declares `type Client = PrismaClient | Prisma.TransactionClient` and each
method does `"$transaction" in client ? client.$transaction((tx) => run(tx)) : run(client)`. This lets
a model method be called either standalone (opens its own transaction) or nested inside a caller's
existing transaction (controller already opens one and passes `tx` through).
**When to use:** All new model functions this phase adds must follow this exact signature so they
compose inside the existing controller-level `prisma.$transaction(async (tx) => {...})` blocks (see
`salesOrder.controller.ts` `createSalesOrder`).

### Pattern 4: Interim status flag ahead of full state machine (Phase 2 precedent)
**What:** Phase 2 added `approve`/`reject` endpoints operating on a plain string status field
(`deliveryStatus` / `status`) rather than waiting for Phase 4's full enum. D-05 continues this: add a
boolean (e.g. `requiresApproval: Boolean @default(false)`) or small string field to `SalesOrder`,
computed by the new credit/discount guard at create/update time, and gate the stock-decrement step
on `!requiresApproval || alreadyApproved`.
**Recommendation:** Use a boolean `requiresApproval` field, NOT a new enum. Phase 4 replacing this
with `DRAFT/PENDING_APPROVAL/APPROVED/...` is a straightforward migration (`requiresApproval: true` →
`PENDING_APPROVAL`, `false` → whatever the order's effective status is) — a boolean is the lowest-cost
placeholder per the CONTEXT's explicit "upgradeable" requirement.

### Anti-Patterns to Avoid
- **Checking-then-writing outside a transaction:** Any lot-quantity check that reads
  `InventoryStock.quantityOnHand` and later writes in a separate query/request is a TOCTOU race —
  two concurrent sales orders could both pass the check against the same lot. Everything must be
  inside one `prisma.$transaction`.
- **Trusting frontend-computed totals for credit/discount checks:** The existing frontend computes
  `projectedBalance` and discount-over-threshold client-side for UX only. The backend guard must
  independently recompute the order's net value/discount from the submitted items and re-derive
  `Customer.currentBalance`/`creditLimit`/`standardDiscount` from the database — never trust a
  client-submitted "requiresApproval" or "approver" field as the source of truth.
- **Storing `lotBatch` as both a free string and an FK during transition:** Pick one. Since the
  frontend already renders `InventoryStock.lotBatch` values in the lot dropdown, the FK migration
  should keep `InventoryStock.lotBatch` (display label) but replace `SalesOrderItem.lotBatch: String`
  entirely with `SalesOrderItem.inventoryStockId: Int` — don't keep both to "ease migration"; that
  reintroduces the exact integrity gap D-01 exists to close.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transactional consistency for check-then-decrement | A custom locking/mutex layer | Prisma's `$transaction` (already used everywhere) | MySQL's default transaction isolation inside a single `$transaction` call is sufficient for this app's concurrency profile; a bespoke lock manager is unjustified complexity |
| Rounding for credit/discount comparisons | A new rounding utility | Whatever rounding helper Phase 1/2 already introduced for per-line rounding (round-half-up, 2dp) — locate and reuse it; do not reintroduce ad hoc `Math.round` | Consistency with the already-resolved rounding decision (see CONTEXT "Rounding" section) |
| Reason-code enum for stock adjustments | A free-text reason field only | A Prisma enum (`DAMAGE, THEFT, RECOUNT, EXPIRY, CORRECTION, OTHER`) + optional free-text note, matching D-06 exactly | Free text alone can't be filtered/reported on later (DOCS-03 CSV export by reason will need this) |
| Audit trail for the new stock-adjustment action | A separate adjustment log table | Existing `AuditLogModel.record` / `audit_logs` table (entity="InventoryStock" or new entity="StockAdjustment", action="adjust") | Phase 2 already built AUDIT-01..04; a parallel logging mechanism would fragment the audit trail DOCS-03/AUDIT-04 need to query |

**Key insight:** Every "don't hand-roll" item in this phase is really "don't build a second version
of infrastructure Phase 1/2 already built." The risk in this phase isn't reaching for the wrong
external library — it's re-deriving patterns that already exist one directory over.

## Runtime State Inventory

Not applicable in the classic rename/migration sense (no string rename), but the **schema
migration itself has data-shape implications** worth treating the same way, because `SalesOrderItem`
rows already exist with free-text `lotBatch` values that must be resolved to `InventoryStock` FKs:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Existing `SalesOrderItem.lotBatch` rows (seeded + any created during Phase 1/2 manual testing) store a free-text string, some of which may not match any real `InventoryStock.lotBatch` for that product (seed data creates `SalesOrder` items with arbitrary lot strings — verified pattern `lotBatch: "LOT-1"` used in tests, which is not guaranteed to exist as a real `InventoryStock` row for that product) | Data migration: for each existing `SalesOrderItem`, resolve to a matching `InventoryStock` row by `(productId, lotBatch)` where possible; where no match exists, either (a) create a placeholder `InventoryStock` row to preserve referential integrity, or (b) null the FK if nullable during transition. Planner must choose explicitly — do not silently drop orphaned rows. |
| Live service config | None — no external service config affected | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Build artifacts | `@prisma/client` generated types must be regenerated (`prisma generate`) after schema changes; any code referencing `SalesOrderItem.lotBatch` as a string (frontend `types.ts`, `SalesOrdersPage.tsx`) will fail to typecheck until updated | Run `prisma generate` as part of the plan's schema-change task; update `apps/frontend/src/api/types.ts` and `SalesOrdersPage.tsx` in the same wave, not a follow-up phase |

**Also flag:** `apps/backend/prisma/seed.ts` currently seeds `ImportOrder` rows at every status
(`STAGING`, `PENDING_APPROVAL`, `RECEIVED`, `APPROVED`, `CUSTOMS_CLEARED`, `ISSUE`) and today's
`ImportOrderModel.create` unconditionally creates stock-IN transactions for all of them regardless of
status. Once D-04 gates stock-IN to `RECEIVED`-only, **re-running the seed will produce different
`Product.stockQty` and `InventoryStock` totals than before** (rows currently at `STAGING`/
`PENDING_APPROVAL`/`APPROVED`/`CUSTOMS_CLEARED`/`ISSUE` will no longer contribute stock). This is a
correctness fix, not a bug in the fix, but the plan must include re-seeding the dev database and
verifying downstream dashboard KPIs (`DashboardKpi`, `DOCS-04` future phase) or any hardcoded
quantity expectations in existing tests don't silently break. Search existing tests for
hardcoded stock-quantity assertions tied to seeded import orders before changing the gate.

## Common Pitfalls

### Pitfall 1: Forgetting `StockTransaction` needs an `inventoryStockId` column too (STOCK-05)
**What goes wrong:** STOCK-05 requires "every stock transaction records product, lot, source
document, and movement type." Today `StockTransaction` has `productId`, `transactionType`,
`referenceNo` (source document) but **no lot reference at all** — it's purely product-level. Adding
the FK only to `SalesOrderItem` satisfies D-01 but not STOCK-05.
**Why it happens:** D-01/D-03's context focuses on `SalesOrderItem`, making it easy to treat
`StockTransaction` as unaffected.
**How to avoid:** Add `inventoryStockId Int?` to `StockTransaction` (nullable, since some historical/
adjustment transactions may not always tie cleanly to one lot, though in practice both sales-OUT and
import-IN transactions will have one after this phase). Update `createStockTransactionTx`'s
`StockTransactionInput` interface to accept it.
**Warning signs:** Plan tasks that only touch `SalesOrderItem`/`InventoryStock` and never mention
`stock_transactions` schema changes are incomplete against STOCK-05's literal text.

### Pitfall 2: Import-order status-gating breaks `update()`'s item-replacement flow
**What goes wrong:** `ImportOrderModel.update` currently calls `reverseAndDeleteByReferenceTx` +
`createStockInTx` unconditionally whenever `items` are provided, regardless of `status`. After D-04,
if an order is edited while still `STAGING` (no lots exist yet), `reverseAndDeleteByReferenceTx` is a
no-op (nothing to reverse — correct), but if items are edited *after* the order reached `RECEIVED`
(lots already created), the naive "delete all StockTransactions for this reference and recreate" must
also delete/recreate the corresponding `InventoryStock` rows, not just leave stale ones. This is the
same reverse-then-reapply requirement as D-03 but for import receiving instead of sales.
**Why it happens:** The existing code was written before lot-level tracking existed; the transaction/
reference-number pattern only ever touched `Product.stockQty`.
**How to avoid:** Explicitly scope: does this phase allow editing items on an already-`RECEIVED`
import order? If yes, the reverse-then-reapply logic must extend to `InventoryStock` deletion/
recreation, which has ripple effects if a `SalesOrderItem.inventoryStockId` already points at that
lot (FK constraint violation on delete). If the phase intends `RECEIVED` orders to be immutable for
items, that must be an explicit rule in the plan, not an assumption.
**Warning signs:** Any test that edits items on a `RECEIVED`-status import order without first
checking for a graceful rejection or a working reverse/reapply path.

### Pitfall 3: Deleting a lot that a sales order line still references
**What goes wrong:** With `SalesOrderItem.inventoryStockId` as a hard FK, deleting an `InventoryStock`
row (via `deleteInventoryStock` in `inventoryStock.controller.ts`, which exists today with
`INVENTORY_DELETE` permission) while a `SalesOrderItem` still references it will either throw an
unhandled Prisma FK-constraint error (ugly 500) or silently cascade-delete sales order items if the
relation is misconfigured with `onDelete: Cascade`.
**Why it happens:** The existing `InventoryStock.importOrderItem` relation uses `onDelete: SetNull`
as a precedent, which might get copy-pasted onto the new `SalesOrderItem → InventoryStock` relation
without thinking through what "sales order item's lot got nulled out" means (STOCK-01 requires stock
to always trace back to a lot).
**How to avoid:** Use `onDelete: Restrict` (default) on `SalesOrderItem.inventoryStockId → InventoryStock`,
matching the existing `SalesOrder.customerLicense` relation's `onDelete: Restrict` precedent — a lot
with sales history cannot be deleted. Return a clear `HttpError(400, ...)` from the delete controller
if Prisma throws `P2003`.
**Warning signs:** No explicit test for "attempt to delete a lot with existing sales order line items."

### Pitfall 4: ENFORCE-06's literal text ("created or last edited") is broader than what's implemented
**What goes wrong:** The existing no-self-approval check (`order.noSelfApproval.test.ts`, verified in
this session) only compares `existing.createdById === req.userId`. `REQUIREMENTS.md`'s ENFORCE-06
text is: *"A user cannot approve a transaction they created **or last edited**."* There is currently
no `updatedById`/`lastEditedById` column on `SalesOrder`/`ImportOrder` at all — `updateSalesOrder`/
`updateImportOrder` never record who performed the edit.
**Why it happens:** The 03-CONTEXT.md explicitly states "No-self-approval (ENFORCE-06) already
exists ... no new no-self-approval logic needed here" — but this statement covers only the
"created by" half, not the "last edited by" half, and CONTEXT.md is a decision record, not a
requirements re-audit.
**How to avoid:** Flag this as an open question for the planner/user rather than silently treating
CONTEXT.md's statement as complete coverage of ENFORCE-06's literal requirement text. See Open
Questions below — do not resolve this unilaterally in research; the discrepancy between the locked
decision and the requirement text needs explicit reconciliation before planning locks in the approve
endpoint as "done, no changes needed."

### Pitfall 5: Rounding drift in credit/discount comparisons across currencies
**What goes wrong:** `Customer.creditLimit`/`currentBalance`/`standardDiscount` are `Decimal` in
Prisma but get converted to JS `number` at multiple points in the existing sales-order code
(`toItemRows`, `orderTotals` all use plain arithmetic on values pulled via Prisma, which returns
`Decimal.js` objects that get implicitly coerced). Comparing `projectedBalance > creditLimit` with
naive floating-point arithmetic can produce off-by-fractions-of-a-cent false negatives right at the
threshold.
**Why it happens:** JS `number` arithmetic on values derived from `Decimal` fields; existing code
already does this (see `salesOrder.model.ts` `toItemRows`), so a new credit/discount guard is likely
to inherit the same imprecision by copy-paste.
**How to avoid:** Apply the already-resolved rounding decision (round-half-up to 2 decimals,
per-line) consistently to the credit/discount guard's computed order total before comparing against
`creditLimit`, matching whatever rounding utility Phase 1/2/3 introduced for tax math — locate it in
the codebase before writing this guard rather than reintroducing raw floating point comparison.
**Warning signs:** A credit-limit test with an order total exactly equal to available credit
(boundary case) that flakes between pass/fail.

## Code Examples

### Existing transaction-scoped guard (model to copy)
```typescript
// Source: apps/backend/src/utils/licenseGate.ts (verified in repo, 2026-09-15)
export const assertProductsNotBlockedTx = async (tx: Prisma.TransactionClient, productIds: number[]) => {
  const uniqueIds = [...new Set(productIds)].filter((id) => Number.isFinite(id));
  if (uniqueIds.length === 0) return;
  const licenses = await tx.license.findMany({ where: { productId: { in: uniqueIds } } });
  for (const license of licenses) {
    const { status } = computePermitStatus(license.expiryDate);
    if (status === "EXPIRED") {
      throw new HttpError(400, `Product ${license.productId} has an expired permit (license ${license.licenseNo}) and cannot be ordered until it is resolved`);
    }
  }
};
```

### Existing stock create/decrement (model to extend one level down)
```typescript
// Source: apps/backend/src/models/stockTransaction.model.ts (verified in repo, 2026-09-15)
export async function createStockTransactionTx(tx: Prisma.TransactionClient, data: StockTransactionInput) {
  if (data.transactionType === "OUT") {
    const product = await tx.product.findUnique({
      where: { productId: data.productId },
      select: { stockQty: true, productName: true },
    });
    if (!product) throw new HttpError(404, `Product ${data.productId} not found`);
    if (product.stockQty < data.quantity) {
      throw new HttpError(400, `Insufficient stock for ${product.productName}: requested ${data.quantity}, available ${product.stockQty}`);
    }
  }
  const transaction = await tx.stockTransaction.create({ data });
  await tx.product.update({
    where: { productId: data.productId },
    data: { stockQty: { increment: stockDelta(data.transactionType, data.quantity) } },
  });
  return transaction;
}
```

### Existing no-self-approval check (already satisfies half of ENFORCE-06)
```typescript
// Source: apps/backend/src/controllers/salesOrder.controller.ts (verified in repo, 2026-09-15)
if (existing.createdById != null && existing.createdById === req.userId) {
  throw new HttpError(403, "You cannot approve an order you created");
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `SalesOrderItem.lotBatch: String` (free text, no FK) | `SalesOrderItem.inventoryStockId: Int` (real FK to `InventoryStock`) | This phase (D-01) | Frontend payload shape changes; existing seeded/test data needs migration/backfill |
| Import order stock-IN fires unconditionally at `create()` | Stock-IN (lot creation) fires only on transition to `RECEIVED` | This phase (D-04) | Seed data and any tests asserting stock quantities immediately after import-order creation must be updated |
| `Product.stockQty` as directly-editable source of truth | `Product.stockQty` derived/synced from `InventoryStock.quantityOnHand` sums | This phase (STOCK-01) | `createStockTransactionTx` continues to update `Product.stockQty` directly today — confirm whether this phase keeps that as a synced cache or requires it to become a computed/derived value (aggregate query) instead. **This is an open question, not yet resolved by CONTEXT.md** — see below. |

**Deprecated/outdated:**
- Direct `PUT /api/inventory-stock/:id` edits to `quantityOnHand`: replaced by an audited
  stock-adjustment action (D-06). The existing generic update endpoint must stop accepting this field.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `Product.stockQty` remains a synced/cached field updated by the same transaction that touches `InventoryStock.quantityOnHand` (rather than being removed entirely and computed via a live aggregate query on every read) | Architecture Patterns, State of the Art | If STOCK-01 actually requires `Product.stockQty` to become a pure computed value (e.g., a Prisma `@@map` view or an on-read `SUM(quantityOnHand)`), the plan's approach of "keep incrementing both fields in the same transaction" would technically satisfy "derived from lot quantities" only in the loose sense (kept in sync) rather than the strict sense (never independently stored). CONTEXT.md's D-01 says "mirrors the existing Product.stockQty pattern... applied one level down," which reads as "keep both, keep them in sync" — but this should be confirmed with the user/planner since STOCK-01's literal text says stock is "derived/synced... not maintained independently." |
| A2 | The interim `requiresApproval` field belongs on `SalesOrder` only, not `ImportOrder` (since ENFORCE-03/04 and D-05 only mention credit limit and discount, both sales-side concepts tied to `Customer`) | Architecture Patterns Pattern 4 | If import orders also need a supplier-side approval-threshold concept in this phase (not indicated anywhere in CONTEXT.md or REQUIREMENTS.md), scoping the field to `SalesOrder` only would miss it. Low risk — no requirement text supports an import-order equivalent. |
| A3 | `onDelete: Restrict` is the correct FK behavior for `SalesOrderItem.inventoryStockId → InventoryStock`, matching the `SalesOrder.customerLicense` precedent | Common Pitfalls #3 | If the planner instead wants cascade-delete or set-null semantics for lots (e.g., to allow lot cleanup), the guard against deleting in-use lots (STOCK-01's "source of truth" guarantee) would be weaker. Low risk given explicit precedent in the same schema file. |
| A4 | Existing `SalesOrderItem.lotBatch` test fixtures (e.g. `"LOT-1"`, `"LOT-2"` in `order.noSelfApproval.test.ts`, `salesOrder.license-block.test.ts`) do not correspond to real `InventoryStock` rows, and all existing sales-order tests will need updating to create a real `InventoryStock` row and pass `inventoryStockId` once D-01 lands | Runtime State Inventory | If this migration isn't done carefully, ~15+ existing test files (see Validation Architecture below) will fail after the schema change, and the plan must budget time for updating them, not just for new tests |

**Note:** All claims above are `[VERIFIED]` against the actual repo state as read in this session
(schema.prisma, model files, controllers, routes, seed.ts, test files) unless explicitly marked
`[ASSUMED]` in this table — this codebase-research is HIGH confidence because it's grounded in
direct file reads, not training-data guesses about typical Prisma/Express patterns.

## Open Questions (RESOLVED)

1. **Does STOCK-01 require removing `Product.stockQty` as a stored column, or just keeping it
   synced?**
   - What we know: The existing pattern (`createStockTransactionTx`) treats `Product.stockQty` as an
     authoritative, directly-incremented field. D-01's context says "mirrors the existing
     Product.stockQty pattern... applied one level down," implying both fields stay directly
     incremented/decremented in parallel.
   - What's unclear: STOCK-01's literal requirement text says stock is "derived/synced... not
     maintained independently," which could mean either (a) keep both fields but always update them
     together in the same transaction (loose "sync"), or (b) remove independent storage entirely and
     compute `Product.stockQty` as `SUM(InventoryStock.quantityOnHand)` on read.
   - Recommendation: Default to (a) — same-transaction sync, matching D-01's explicit "mirrors the
     existing pattern" language and avoiding a performance-costly aggregate query on every product
     read (used heavily across the app: dashboards, product lists, stock validation). Flag this
     explicitly for the planner/user to confirm rather than assume silently, since it affects whether
     a data-integrity job (recomputing `stockQty` from lot sums) is needed as a startup/migration
     task.
   - **Resolution:** RESOLVED — 03-02-PLAN.md Task 3 adopted recommendation (a): same-transaction sync, `Product.stockQty` remains a directly-incremented column alongside `InventoryStock.quantityOnHand`, both updated in the same transaction via `createStockTransactionTx`/`reverseAndDeleteByReferenceTx`. No aggregate-on-read or data-integrity migration job was needed.

2. **Does ENFORCE-06's "or last edited" clause require a new `lastEditedById`/`updatedById` column
   this phase, or is it explicitly deferred?**
   - What we know: The existing approve/reject check only covers `createdById`. CONTEXT.md states
     no new no-self-approval logic is needed, but that statement predates a close re-read of
     REQUIREMENTS.md's literal ENFORCE-06 text ("created **or last edited**").
   - What's unclear: Whether the CONTEXT.md author considered the "last edited" clause explicitly and
     decided to defer it (e.g., to Phase 4 alongside the full approval workflow) or simply didn't
     re-derive it from the requirement text.
   - Recommendation: Surface this discrepancy to the user during planning/discuss rather than
     silently either (a) adding a new column+check unprompted (which would contradict the locked
     CONTEXT.md decision saying "no new logic needed"), or (b) silently leaving ENFORCE-06
     incompletely satisfied. This is exactly the kind of gap a plan-checker should catch.
   - **Resolution:** RESOLVED — CONTEXT.md D-09 confirms the "last edited" clause is in-scope this phase: a new `updatedById` column was added to `SalesOrder` and checked alongside `createdById` in the approve/reject self-approval guard; implemented in 03-04-PLAN.md.

3. **Should `ImportOrder` items be editable at all once `status === "RECEIVED"` (i.e., lots already
   created), and if so, how does reverse-then-reapply interact with lots already referenced by sales
   orders?**
   - What we know: `ImportOrderModel.update` currently allows item replacement unconditionally.
     D-04 only specifies when lot creation happens (on RECEIVED transition), not whether RECEIVED
     orders remain editable.
   - What's unclear: If a RECEIVED import order's items are edited, and a sales order has already
     drawn down the resulting lot, reversing and recreating that lot could either fail (FK restrict)
     or silently break sales order data integrity.
   - Recommendation: Simplest safe default — once `status === "RECEIVED"`, reject item edits with a
     clear `HttpError(400, "Cannot edit items on a received import order; use a stock-adjustment
     instead")`, redirecting corrections through D-06's adjustment path. Confirm with planner/user
     before implementation since this is a new business rule not explicitly stated in CONTEXT.md.
   - **Resolution:** RESOLVED — CONTEXT.md D-10 locks the simplest-safe-default recommendation: once `status === "RECEIVED"`, item edits are rejected with `HttpError(400, "Cannot edit items on a received import order; use a stock-adjustment instead")`; implemented in 03-05-PLAN.md Task 1.

4. **Lot/batch numbering: auto-generate vs. capture explicit lot number from receiving user?**
   - What we know: D-04 explicitly leaves this to planner discretion, preferring auto-generated with
     an optional override "if cheap to add."
   - What's unclear: Whether the receiving UI (existing import-order edit form, or a new receiving
     step) exposes a lot-number input field at all today — not found in the files read this session
     (`apps/frontend` was only spot-checked for `SalesOrdersPage.tsx` and `InventoryStockPage.tsx`,
     not an import-order receiving form).
   - Recommendation: Planner should grep `apps/frontend/src/pages/ImportOrdersPage.tsx` (not read in
     this research session) for any existing lot/batch input before deciding; if none exists,
     auto-generate via `{orderNo}-{itemIndex}` (matching `stockReference.ts`'s existing convention)
     with an optional override field is the lowest-risk default per D-04's own guidance.
   - **Resolution:** RESOLVED — 03-05-PLAN.md confirmed via grep of `apps/frontend/src/pages/ImportOrdersPage.tsx` that no lot/batch-number input field exists in the receiving UI; auto-generated `{orderNo}-{itemIndex+1}` numbering was adopted, no override field added this phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Prisma CLI | Schema migration (`prisma migrate dev` / `db push`) | ✓ | 6.19.3 | — |
| MySQL (via `DATABASE_URL`) | All backend tests, dev DB | Assumed ✓ (existing test suite runs against it) | — | — |
| vitest | Running/writing new tests | ✓ | ^2.1.8 | — |
| supertest | HTTP-level integration tests | ✓ | ^7.0.0 | — |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:** None identified — this phase uses only already-installed
tooling.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.8 + Supertest 7.0.0 |
| Config file | `apps/backend/vitest.config.ts` (not read this session — assume standard, matches existing 34 test files) |
| Quick run command | `npx vitest run tests/<file>.test.ts` (from `apps/backend`) |
| Full suite command | `npm test` (from `apps/backend`, runs `vitest run`) |

Existing test conventions (verified from `salesOrder.license-block.test.ts` and
`order.noSelfApproval.test.ts`):
- Tests hit the real Express `app` via `supertest`, against a real (test) database via `prisma` from
  `tests/setup.js`.
- `createTestUserWithRoles(suffix, roleCodes)` from `tests/fixtures/testUser.ts` creates a real user
  with real role assignments and returns credentials for login.
- Each `describe` block creates its own category/supplier/product/customer/license fixtures with
  `Date.now()`-suffixed unique codes, and cleans them up in `afterAll` (including
  `stockTransaction`/`auditLog` cleanup where relevant) — this pattern must be followed for new lot/
  credit/discount tests to avoid cross-test pollution.
- Tests assert on `res.body.error.toLowerCase()).toContain("...")` for error-message matching — new
  guard functions' error messages should use predictable, lowercase-matchable substrings
  (`"insufficient"`, `"exceeds"`, `"credit"`, `"discount"`, `"expired"`, etc.).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENFORCE-01 | Reject sales order for expired/revoked/suspended/missing customer license via direct API | integration | `npx vitest run tests/salesOrder.license-block.test.ts` | ✅ exists (partially — covers product-linked License expiry; verify it also covers CustomerLicense expired/revoked/suspended/missing) — Wave 0: extend or add `customerLicense.enforcement.test.ts` |
| ENFORCE-02 | Reject sales order line exceeding lot's available quantity | integration | `npx vitest run tests/stock.lotQuantity.test.ts` | ❌ Wave 0 |
| ENFORCE-03 | Reject/flag sales order exceeding credit limit unless approved | integration | `npx vitest run tests/salesOrder.creditLimit.test.ts` | ❌ Wave 0 |
| ENFORCE-04 | Require approval when discount exceeds customer's allowed discount | integration | `npx vitest run tests/salesOrder.discountLimit.test.ts` | ❌ Wave 0 |
| ENFORCE-05 | Reject negative qty / invalid price / invalid discount / invalid status transition | integration | `npx vitest run tests/salesOrder.inputValidation.test.ts` | ❌ Wave 0 (some coverage may exist in `order.genericUpdateRestriction.test.ts` — verify before writing new file) |
| ENFORCE-06 | Cannot approve own created-or-last-edited transaction | integration | `npx vitest run tests/order.noSelfApproval.test.ts` | ✅ exists for "created" half; ❌ Wave 0 for "last edited" half pending Open Question #2 resolution |
| STOCK-01 | Product-level stock derived from lot quantities, not independently edited | integration + unit | `npx vitest run tests/stock.sourceOfTruth.test.ts` | ❌ Wave 0 |
| STOCK-02 | Sales order create decrements lot quantity in same transaction | integration | `npx vitest run tests/stock.lotDecrement.test.ts` | ❌ Wave 0 |
| STOCK-03 | Delete/edit sales order restores prior lot quantity before reapplying | integration | `npx vitest run tests/stock.lotReverseReapply.test.ts` | ❌ Wave 0 |
| STOCK-04 | Import receiving creates/updates lots with qty/warehouse/date/lot number | integration | `npx vitest run tests/importOrder.receivingLots.test.ts` | ❌ Wave 0 |
| STOCK-05 | Stock transactions record product, lot, source document, movement type | unit + integration | `npx vitest run tests/stockTransaction.lotReference.test.ts` | ❌ Wave 0 |
| STOCK-06 | Manual quantityOnHand edits blocked; adjustment requires reason code + audit | integration | `npx vitest run tests/inventoryStock.adjustment.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/<relevant-file>.test.ts` (targeted, <30s)
- **Per wave merge:** `npm test` (from `apps/backend`) — full suite, including the ~15 existing
  order/audit/rbac tests that reference `lotBatch` and will need updating alongside the schema change
- **Phase gate:** Full suite green before `/gsd-verify-work`, plus a manual `prisma migrate dev` (or
  `db push`) + `prisma db seed` run to confirm the seed script still succeeds against the new schema

### Wave 0 Gaps
- [ ] `tests/stock.lotQuantity.test.ts` — covers ENFORCE-02
- [ ] `tests/salesOrder.creditLimit.test.ts` — covers ENFORCE-03
- [ ] `tests/salesOrder.discountLimit.test.ts` — covers ENFORCE-04
- [ ] `tests/stock.lotDecrement.test.ts` — covers STOCK-02
- [ ] `tests/stock.lotReverseReapply.test.ts` — covers STOCK-03
- [ ] `tests/importOrder.receivingLots.test.ts` — covers STOCK-04
- [ ] `tests/stockTransaction.lotReference.test.ts` — covers STOCK-05
- [ ] `tests/inventoryStock.adjustment.test.ts` — covers STOCK-06
- [ ] **Update existing tests referencing `lotBatch` as a string** (`salesOrder.license-block.test.ts`,
      `order.noSelfApproval.test.ts`, `rbac.enforcement.writes.orders.test.ts`, `audit.crud.orders.test.ts`,
      and any others found via `grep -rl "lotBatch:" apps/backend/tests`) — these will fail to compile/
      pass once `SalesOrderItem.lotBatch` becomes `inventoryStockId`. This is not a "new test" gap but
      a mandatory migration task that must be sized into the plan's effort estimate.
- [ ] Framework install: none — vitest/supertest already present

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (unchanged this phase) | Existing `requireAuth` middleware (Phase 1) |
| V3 Session Management | No (unchanged this phase) | Existing refresh-token flow (Phase 1) |
| V4 Access Control | Yes | `requirePermission("STOCK_ADJUSTMENT_CREATE")` (new code) or reuse `INVENTORY_EDIT`-adjacent permission for D-06; existing `requirePermission` middleware pattern |
| V5 Input Validation | Yes | Reject negative quantities, invalid prices/discounts/status transitions server-side (ENFORCE-05) — extend existing controller-level parsing (`parseItems` in `salesOrder.controller.ts`) with explicit `>= 0` / range checks rather than relying on Prisma's type coercion alone |
| V6 Cryptography | No (unchanged this phase) | — |
| V11 Business Logic | Yes | This entire phase is a V11 concern: license/credit/discount/stock rules must be enforceable independent of client trust — exactly the "backend regardless of caller" framing in the phase goal |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Direct API call bypassing frontend's client-side credit/discount/lot checks (this phase's entire premise) | Tampering / Elevation of Privilege | Re-derive and enforce all business rules server-side inside the same `$transaction` as the write, never trusting client-submitted computed fields (e.g., a client-sent `requiresApproval: false`) |
| Race condition between lot-quantity check and decrement across two concurrent requests | Tampering (double-spend of stock) | Single `prisma.$transaction` wrapping check + decrement (already the established pattern); consider `SELECT ... FOR UPDATE` semantics if MySQL isolation level proves insufficient under load testing (not expected to be needed at this app's scale, but worth a Wave 0 note) |
| Self-approval to bypass credit/discount gate (already partially mitigated) | Elevation of Privilege | Existing no-self-approval check on `createdById`; extend per Open Question #2 if "last edited" is in scope |
| Negative-quantity or negative-price injection to manipulate totals/stock | Tampering | Explicit numeric range validation in controllers (`>= 0` for quantity, `> 0` for unitPrice) before any calculation — ENFORCE-05 |

## Sources

### Primary (HIGH confidence — direct codebase reads, 2026-09-15)
- `apps/backend/prisma/schema.prisma` — full current schema
- `apps/backend/src/models/stockTransaction.model.ts` — stock create/reverse pattern
- `apps/backend/src/utils/licenseGate.ts` — transaction-scoped guard pattern
- `apps/backend/src/utils/stockReference.ts` — reference-number helpers
- `apps/backend/src/models/salesOrder.model.ts` — sales order transaction wiring, license snapshot
- `apps/backend/src/models/importOrder.model.ts` — import order transaction wiring
- `apps/backend/src/models/customerLicense.model.ts` — `isLicenseValid` logic
- `apps/backend/src/controllers/salesOrder.controller.ts` — approve/reject, no-self-approval check
- `apps/backend/src/controllers/importOrder.controller.ts` — same, import side
- `apps/backend/src/controllers/inventoryStock.controller.ts` — current unrestricted `quantityOnHand` edit (D-06's target)
- `apps/backend/src/middleware/permission.ts` — `requirePermission` pattern
- `apps/backend/src/lib/audit.ts` — `AuditLogModel.record`
- `apps/backend/src/models/role.model.ts` — permission resolution
- `apps/backend/prisma/seed.ts` (permissions block, import order statuses) — role/permission codes, seeded status distribution
- `apps/backend/tests/salesOrder.license-block.test.ts`, `apps/backend/tests/order.noSelfApproval.test.ts`, `apps/backend/tests/fixtures/testUser.ts` — test conventions
- `apps/frontend/src/pages/SalesOrdersPage.tsx` — existing lot-selection UI and client-side credit/discount warning logic (the "fake enforcement" this phase must replace)
- `.planning/phases/03-backend-enforcement-lot-batch-stock-control/03-CONTEXT.md` — locked decisions
- `.planning/REQUIREMENTS.md` — literal requirement text for ENFORCE-01..06, STOCK-01..06
- `.planning/STATE.md` — project history, Phase 4 risk flag re: stock-deduction trigger location
- `apps/backend/package.json`, `npx prisma -v` — verified installed versions

### Secondary (MEDIUM confidence)
None used — all findings this session were verified directly against the repository rather than
via web search, since this phase is pure extension of existing, readable code rather than new
technology adoption.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, versions confirmed via `npx prisma -v` and `package.json`
- Architecture: HIGH — every pattern cited is copied/extended from code read directly in this session
- Pitfalls: HIGH for codebase-derived pitfalls (FK constraints, transaction gaps, ENFORCE-06 text gap);
  MEDIUM for the STOCK-01 "derived vs. synced" distinction (Open Question 1) since it depends on user
  intent not yet locked in CONTEXT.md

**Research date:** 2026-09-15
**Valid until:** No external expiry pressure (internal codebase research, not framework-version
dependent) — revalidate only if CONTEXT.md decisions change before planning.
