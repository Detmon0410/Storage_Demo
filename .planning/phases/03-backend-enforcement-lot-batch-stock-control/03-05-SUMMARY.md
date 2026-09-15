---
phase: 03-backend-enforcement-lot-batch-stock-control
plan: 05
subsystem: backend
tags: [prisma, import-orders, inventory-lots, validation, enforcement]

# Dependency graph
requires:
  - phase: 03-backend-enforcement-lot-batch-stock-control
    plan: "01"
    provides: "InventoryStock model, StockTransaction.inventoryStockId FK"
  - phase: 03-backend-enforcement-lot-batch-stock-control
    plan: "02"
    provides: "createStockTransactionTx/reverseAndDeleteByReferenceTx InventoryStock.quantityOnHand sync"
provides:
  - "Import orders only create InventoryStock lots and stock-IN transactions on transition to RECEIVED (fixes D-04 overselling risk)"
  - "createOrUpdateLotsFromReceivingTx — creates one InventoryStock lot + linked IN StockTransaction per received item"
  - "D-10: item edits on an already-RECEIVED import order are hard-rejected"
  - "ENFORCE-05: import order item quantity/price validation, status value/transition validation (assertValidImportStatusTransition)"
affects: [03-06, 03-07, 03-08, 03-09, 03-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Status-gated side-effect creation: real inventory/stock-transaction writes only fire on a specific status value, not on every create/update call"
    - "Minimal interim status-pipeline validator (assertValidImportStatusTransition) mirroring 03-04's salesOrder controller pattern — not a full state machine, deferred to Phase 4"

key-files:
  created:
    - apps/backend/tests/importOrder.receivingGate.test.ts
    - apps/backend/tests/importOrder.enforce05.test.ts
  modified:
    - apps/backend/src/models/importOrder.model.ts
    - apps/backend/src/controllers/importOrder.controller.ts
    - apps/backend/tests/models.txClient.test.ts
    - apps/backend/tests/audit.crud.orders.test.ts
    - apps/backend/tests/importOrder.license-block.test.ts
    - apps/backend/tests/order.genericUpdateRestriction.test.ts
    - apps/backend/tests/order.noSelfApproval.test.ts
    - apps/backend/tests/rbac.enforcement.writes.orders.test.ts

key-decisions:
  - "InventoryStock lots are created with quantityOnHand: 0 and then incremented to the real quantity by createStockTransactionTx's InventoryStock sync (03-02) — setting quantityOnHand directly at lot-creation time AND passing inventoryStockId to createStockTransactionTx would double-count the received quantity; caught by the new receivingGate test before it shipped"
  - "Verified the frontend's actual PUT/POST payload shape (apps/frontend/src/pages/ImportOrdersPage.tsx handleSubmit, lines 140-176): it always submits the full items array on every create/update, including status-only changes. T-03-19's accepted risk (status->RECEIVED without items never creates lots) is therefore a non-issue for the current frontend — confirmed, not just assumed."
  - "Updated 8 pre-existing test fixtures that created import orders with status: \"PENDING\" (never a valid ImportOrder.status value in the confirmed vocabulary) to use \"STAGING\" or \"RECEIVED\" as appropriate — these assertions only passed before because no status validation existed and because the D-04 bug made every create fire a stock-IN transaction regardless of status"

patterns-established:
  - "Any future writer of ImportOrder-linked InventoryStock rows must create the lot with quantityOnHand: 0 first, then let createStockTransactionTx (with inventoryStockId set) perform the real increment — never set both independently"

requirements-completed: [STOCK-04, STOCK-05, ENFORCE-05]

# Metrics
duration: 45min
completed: 2026-09-15
---

# Phase 3 Plan 05: Import Order Receiving Gate & ENFORCE-05 Validation Summary

**Fixed the D-04 overselling bug by gating InventoryStock lot / stock-IN transaction creation strictly behind an import order's transition to RECEIVED status, made RECEIVED orders' line items immutable (D-10), and added ENFORCE-05 item/status validation to the import order controller.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-15T14:50:00Z (approx, worktree base-correction preceded this)
- **Completed:** 2026-09-15T15:35:00Z (approx)
- **Tasks:** 2
- **Files modified:** 10 (2 source files, 2 new test files, 6 pre-existing test files updated for the fixed behavior)

## Accomplishments
- `ImportOrderModel.create`/`update` no longer fire an unconditional stock-IN transaction on every write — lots/stock-transactions are created only when `status === "RECEIVED"`, closing the real overselling risk where staged/pending import orders inflated available stock
- New `createOrUpdateLotsFromReceivingTx` creates one `InventoryStock` lot (auto lot/batch number `{orderNo}-{index+1}`, warehouse/stockStatus defaults) and one linked `IN` `StockTransaction` (via `inventoryStockId`) per received item
- `ImportOrderModel.update` hard-rejects any items-array edit once the existing order's `status === "RECEIVED"` (D-10), before any write occurs; non-item field updates (e.g. status-only changes) remain allowed
- `importOrder.controller.ts`'s `parseItems` now rejects non-positive `quantity` and negative `unitPrice`, matching the sales order controller's convention
- New `assertValidImportStatusTransition` rejects unknown `status` values, illegal backward transitions, and any change away from a terminal state (`REJECTED`/`ISSUE`), wired into both `createImportOrder` and `updateImportOrder`
- Caught and fixed a double-counting bug during TDD: creating the lot with the real quantity AND letting `createStockTransactionTx`'s InventoryStock sync increment it again would have doubled `quantityOnHand`

## Task Commits

Each task followed RED/GREEN TDD and was committed atomically:

1. **Task 1: Gate lot/stock-IN creation behind RECEIVED transition; block item edits once RECEIVED** - test: `fbd9783`, feat: `8db7845`
2. **Task 2: ENFORCE-05 input validation for import order items and status transitions** - test: `4fd09a7`, feat: `9996eee`

## Files Created/Modified
- `apps/backend/src/models/importOrder.model.ts` - Replaced unconditional `createStockInTx` with `createOrUpdateLotsFromReceivingTx`, gated on `status === "RECEIVED"` in both `create` and `update`; added D-10 item-edit-lock guard in `update`
- `apps/backend/src/controllers/importOrder.controller.ts` - `parseItems` quantity/price validation; new `assertValidImportStatusTransition` wired into `createImportOrder`/`updateImportOrder`
- `apps/backend/tests/importOrder.receivingGate.test.ts` - New: 5 tests covering STAGING (no lots), RECEIVED (lots+tx), STAGING->RECEIVED transition (lots created once), RECEIVED item-edit rejection, RECEIVED status-only update (allowed)
- `apps/backend/tests/importOrder.enforce05.test.ts` - New: 7 tests covering negative quantity/price rejection, valid-item acceptance, unknown status rejection, backward transition rejection, terminal-state rejection, no-op status cases
- `apps/backend/tests/models.txClient.test.ts` - Changed import order fixture status `"PENDING"` -> `"RECEIVED"` so the "linked IN stock transaction" assertion still holds under the new gating behavior
- `apps/backend/tests/audit.crud.orders.test.ts` - Changed 2 import order fixture statuses (`"PENDING"` -> `"RECEIVED"` where a stock-tx assertion follows, `"PENDING"` -> `"STAGING"` where it doesn't)
- `apps/backend/tests/importOrder.license-block.test.ts` - Changed 3 import order fixture statuses `"PENDING"` -> `"STAGING"` (none of these tests check stock-tx creation)
- `apps/backend/tests/order.genericUpdateRestriction.test.ts` - Changed 2 import order fixture statuses `"PENDING"` -> `"STAGING"`
- `apps/backend/tests/order.noSelfApproval.test.ts` - Changed 1 import order fixture status `"PENDING"` -> `"STAGING"` (the second `"PENDING"` occurrence in this file is a raw `prisma.importOrder.create` call that bypasses the controller/model entirely and needed no change)
- `apps/backend/tests/rbac.enforcement.writes.orders.test.ts` - Changed 1 import order fixture status `"PENDING"` -> `"STAGING"`

## Decisions Made
- Lot `quantityOnHand` is created at `0` and incremented to the real received quantity by `createStockTransactionTx`'s existing InventoryStock sync (from 03-02), rather than being set directly at creation time — avoids double-counting since both code paths would otherwise touch the same field. This was caught by the new TDD test (`importOrder.receivingGate.test.ts`) before being shipped, not discovered after the fact.
- Confirmed via reading `apps/frontend/src/pages/ImportOrdersPage.tsx`'s `handleSubmit` (lines 140-176) that the frontend always submits the full `items` array on every create/update PUT, including pure status-change submissions. This resolves T-03-19's "accepted" risk from the threat model as a non-issue for the current frontend: there is no code path today where `status: "RECEIVED"` is submitted without `items`, so the documented limitation (lots not created on a bare status-only RECEIVED transition) never triggers in practice.
- Updated 8 pre-existing test call sites across 6 files that used `status: "PENDING"` — not a member of the confirmed `ImportOrder.status` vocabulary (`STAGING`, `PENDING_APPROVAL`, `APPROVED`, `CUSTOMS_CLEARED`, `RECEIVED`, `ISSUE`, `REJECTED`) — to a valid status. These assertions previously passed only as a side effect of the D-04 bug (every create fired a stock-IN transaction regardless of status) and/or the absence of any status validation; per the deviation Rule 1 scope boundary, this is directly caused by this plan's intended behavior change, not an out-of-scope fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Double-counted `InventoryStock.quantityOnHand` on lot creation**
- **Found during:** Task 1, running the new `importOrder.receivingGate.test.ts` GREEN pass
- **Issue:** The plan's `<action>` code created the `InventoryStock` lot with `quantityOnHand: item.quantity` and then called `createStockTransactionTx` with `inventoryStockId` set. Since 03-02 extended `createStockTransactionTx` to also increment the linked `InventoryStock.quantityOnHand` by the transaction's delta, a received quantity of 100 resulted in a lot with `quantityOnHand: 200`.
- **Fix:** Create the lot with `quantityOnHand: 0`; `createStockTransactionTx`'s existing sync then increments it to the correct value.
- **Files modified:** `apps/backend/src/models/importOrder.model.ts`
- **Verification:** `importOrder.receivingGate.test.ts`'s "create with status RECEIVED..." test asserts `quantityOnHand: 100` for a `quantity: 100` item; failed with `200` before the fix, passes after
- **Committed in:** `8db7845` (Task 1 feat commit)

**2. [Rule 1 - Bug] 8 pre-existing test fixtures used an out-of-vocabulary `"PENDING"` import-order status**
- **Found during:** Task 1 (2 fixtures depending on stock-tx-on-create) and Task 2 (6 fixtures rejected by the new status validation) regression runs
- **Issue:** `"PENDING"` is not a member of the confirmed `ImportOrder.status` vocabulary and was never a valid business status for import orders (it is the `SalesOrder.deliveryStatus` value, mistakenly reused). It only "worked" before because (a) no status validation existed to reject it and (b) the D-04 bug fired a stock-IN transaction unconditionally, so stock-tx assertions kept passing regardless of the status value used.
- **Fix:** Changed each occurrence to `"STAGING"` (fixtures with no stock-tx assertion) or `"RECEIVED"` (fixtures asserting a linked stock-IN transaction was created).
- **Files modified:** `apps/backend/tests/models.txClient.test.ts`, `apps/backend/tests/audit.crud.orders.test.ts`, `apps/backend/tests/importOrder.license-block.test.ts`, `apps/backend/tests/order.genericUpdateRestriction.test.ts`, `apps/backend/tests/order.noSelfApproval.test.ts`, `apps/backend/tests/rbac.enforcement.writes.orders.test.ts`
- **Verification:** Ran the full backend test suite (`npx vitest run`) after all fixes — 0 import-order-related failures remain; the only 10 remaining failures are the pre-existing, already-documented `salesOrder.model.ts` lotBatch/inventoryStockId mismatch (see Out-of-Scope Discovery below)
- **Committed in:** `8db7845` (2 fixtures, Task 1) and `9996eee` (6 fixtures, Task 2)

---

**Total deviations:** 2 auto-fixed (1 bug in new code, 1 bug-fix ripple through pre-existing test fixtures)
**Impact on plan:** Both were necessary and directly caused by this plan's intended behavior change (fixing D-04/adding ENFORCE-05). No scope creep — the sales-order-side test failures below were left untouched.

## Out-of-Scope Discovery (Deferred, Not Fixed)

The full backend test suite (`npx vitest run`) shows 10 remaining failures, all in SalesOrder-side tests (`audit.crud.orders.test.ts`, `models.txClient.test.ts`, `order.genericUpdateRestriction.test.ts`, `order.noSelfApproval.test.ts`, `rbac.enforcement.writes.orders.test.ts`, `salesOrder.license-block.test.ts`). All trace back to the same pre-existing issue already documented in `.planning/phases/03-backend-enforcement-lot-batch-stock-control/deferred-items.md` (originally flagged by 03-01-SUMMARY.md and 03-02-SUMMARY.md): `apps/backend/src/models/salesOrder.model.ts` (lines ~115, ~174) still constructs `SalesOrderItem` create data using the old free-text `lotBatch` field, which 03-01's schema migration replaced with a required `inventoryStockId` FK. `npx tsc --noEmit` confirms these are the only 2 remaining type errors in the whole backend, both in `salesOrder.model.ts`. Not fixed here — out of this plan's file scope (`importOrder.model.ts`, `importOrder.controller.ts`) and expected to be resolved by 03-04-PLAN.md, which is executing in parallel in a separate worktree this wave.

## Issues Encountered
- Fresh worktree had no `node_modules` (ran `pnpm install`) and no `apps/backend/.env` (copied from the main checkout, gitignored, same precedent as 03-01/03-02/03-03 SUMMARYs).
- Worktree branch base was initially incorrect (based on an older commit); corrected via `git reset --hard` to `e37872e` per the worktree_branch_check step before any file edits.

## User Setup Required

None - no external service configuration required. Same `.env` gitignore caveat as prior phase-3 plans: any other clone/worktree needs `apps/backend/.env` with `DATABASE_URL`, `PORT`, `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL`, `ALLOWED_ORIGINS`.

## Next Phase Readiness
- Import orders now correctly reflect real received inventory only — no downstream plan needs to special-case the D-04 bug
- `assertValidImportStatusTransition` establishes the same minimal interim-pipeline validation pattern 03-04 uses for sales orders; Phase 4's full approval/status-machine work can supersede both cleanly
- Flag for the orchestrator: the 10 remaining SalesOrder-side test failures (pre-existing `lotBatch` mismatch) are unrelated to this plan and should be resolved by 03-04's merge, not re-investigated here
- `npx tsc --noEmit` shows 0 errors in `importOrder.model.ts` and `importOrder.controller.ts`; the only 2 remaining backend type errors are in `salesOrder.model.ts` (03-04's responsibility)

---
*Phase: 03-backend-enforcement-lot-batch-stock-control*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: apps/backend/src/models/importOrder.model.ts
- FOUND: apps/backend/src/controllers/importOrder.controller.ts
- FOUND: apps/backend/tests/importOrder.receivingGate.test.ts
- FOUND: apps/backend/tests/importOrder.enforce05.test.ts
- FOUND commit: fbd9783
- FOUND commit: 8db7845
- FOUND commit: 4fd09a7
- FOUND commit: 9996eee
