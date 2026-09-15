---
phase: 03-backend-enforcement-lot-batch-stock-control
plan: 08
subsystem: testing
tags: [vitest, supertest, prisma, import-orders, inventory-lots, regression-test]

# Dependency graph
requires:
  - phase: 03-backend-enforcement-lot-batch-stock-control
    plan: "05"
    provides: "Import order receiving-gate model logic (createOrUpdateLotsFromReceivingTx), D-10 item-edit lock, ENFORCE-05 controller validation (assertValidImportStatusTransition, parseItems)"
  - phase: 03-backend-enforcement-lot-batch-stock-control
    plan: "02"
    provides: "createStockTransactionTx/reverseAndDeleteByReferenceTx InventoryStock.quantityOnHand sync"
provides:
  - "HTTP-layer regression test proving the D-04 overselling bug fix: STAGING import orders produce zero InventoryStock/StockTransaction rows"
  - "HTTP-layer test proving RECEIVED import orders create exactly one lot + one linked IN StockTransaction per item, including the multi-item case"
  - "HTTP-layer test proving RECEIVED item-edit immutability (D-10) and that non-item field edits remain allowed"
  - "Direct-call test proving createStockTransactionTx carries inventoryStockId onto StockTransaction rows and syncs InventoryStock.quantityOnHand, stays backward-compatible when omitted, and reverseAndDeleteByReferenceTx correctly restores lot quantity (STOCK-05)"
  - "HTTP-layer test closing the ENFORCE-05 coverage gap for import orders: negative quantity/price rejection, unknown status rejection, backward-transition rejection, terminal-state rejection, and a positive control for legitimate forward transitions"
affects: [03-09, 03-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "HTTP-layer (supertest) regression coverage complements existing model-layer tests from 03-05, exercising the full controller auth/parseItems/status-transition stack that model-only tests skip"

key-files:
  created:
    - apps/backend/tests/importOrder.receivingLots.test.ts
    - apps/backend/tests/stockTransaction.lotReference.test.ts
    - apps/backend/tests/importOrder.inputValidation.test.ts
  modified: []

key-decisions:
  - "03-05 already created model-layer tests (importOrder.receivingGate.test.ts, importOrder.enforce05.test.ts) and stockTransaction.inventoryStock.test.ts covering closely related scenarios as part of its TDD cycle. This plan's three files are new, distinctly-named artifacts required by the plan contract and exercise the HTTP/controller layer (auth, parseItems, assertValidImportStatusTransition wiring) rather than calling ImportOrderModel/createStockTransactionTx directly against a bare $transaction, so they are not pure duplicates — they close a real coverage gap (controller-level parsing/validation/auth) even though the underlying business logic was already regression-tested at the model layer."

requirements-completed: [STOCK-04, STOCK-05, ENFORCE-05]

# Metrics
duration: 25min
completed: 2026-09-15
---

# Phase 3 Plan 08: Import Order Receiving-Lots, Lot-Reference & Input-Validation Test Coverage Summary

**Three new automated test files (14 tests total, all green) proving the D-04 overselling-bug fix, STOCK-05 lot-reference behavior, and ENFORCE-05 import-order validation at the HTTP/controller layer.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-15T07:58:00Z (approx, after worktree base correction and dependency install/generate)
- **Completed:** 2026-09-15T08:08:00Z (approx)
- **Tasks:** 3
- **Files modified:** 3 (all new test files)

## Accomplishments
- `importOrder.receivingLots.test.ts` (5 tests): STAGING creation produces zero `InventoryStock`/`StockTransaction` rows (the direct D-04 regression test); RECEIVED creation with two different-product items produces exactly 2 lots with correct `quantityOnHand`/`warehouse`/`receivedDate`/`lotBatch` and 2 linked IN `StockTransaction` rows; STAGING->RECEIVED transition via PUT creates lots exactly once; item edits on a RECEIVED order are rejected (400, "received") with no stock-row mutation; non-item field edits on a RECEIVED order remain allowed (200)
- `stockTransaction.lotReference.test.ts` (3 tests): `createStockTransactionTx` called directly inside `prisma.$transaction` carries the supplied `inventoryStockId` onto the created row and increments the lot's `quantityOnHand`; omitting `inventoryStockId` leaves it `null` with no error (backward compatibility); `reverseAndDeleteByReferenceTx` restores the lot's `quantityOnHand` and deletes the transaction row
- `importOrder.inputValidation.test.ts` (6 tests): negative quantity rejected ("positive"), negative unitPrice rejected ("negative"), unknown status value rejected ("invalid status"), backward status transition rejected ("invalid status transition"), status change away from a terminal state (ISSUE) rejected ("terminal state"), and a positive control confirming a legitimate forward transition (STAGING -> PENDING_APPROVAL) still succeeds
- All 14 tests passed on the first run with zero code changes required — 03-05's receiving-gate/ENFORCE-05 implementation and 03-02's InventoryStock sync logic were already correct; this plan adds the HTTP/controller-layer coverage that was missing

## Task Commits

Each task was committed atomically:

1. **Task 1: Receiving-gate tests + RECEIVED item-edit immutability (STOCK-04, D-10)** - `ac38701` (test)
2. **Task 2: StockTransaction lot-reference test (STOCK-05)** - `2e0acae` (test)
3. **Task 3: ENFORCE-05 input + status-transition validation for import orders** - `91fd2d4` (test)

## Files Created/Modified
- `apps/backend/tests/importOrder.receivingLots.test.ts` - New: 5 HTTP-layer (`supertest`) tests against `POST`/`PUT /api/import-orders` covering the STOCK-04/D-10 scenarios described above
- `apps/backend/tests/stockTransaction.lotReference.test.ts` - New: 3 direct-call tests against `createStockTransactionTx`/`reverseAndDeleteByReferenceTx` run inside `prisma.$transaction`, no HTTP layer, proving STOCK-05
- `apps/backend/tests/importOrder.inputValidation.test.ts` - New: 6 HTTP-layer tests against `POST`/`PUT /api/import-orders` covering ENFORCE-05 item validation and status-value/transition validation

## Decisions Made
- Discovered during `<read_first>` review that 03-05 had already created `importOrder.receivingGate.test.ts` (model-layer, calling `ImportOrderModel` directly) and `importOrder.enforce05.test.ts` (HTTP-layer, near-identical scenarios to this plan's Task 3) as part of its own TDD cycle, plus `stockTransaction.inventoryStock.test.ts` (using `StockTransactionModel.create` rather than `createStockTransactionTx` directly). Decided to proceed with creating this plan's three explicitly-named artifact files anyway, since (a) the plan's `must_haves.artifacts` contract requires these exact paths for downstream plans/traceability, and (b) `importOrder.receivingLots.test.ts` and `importOrder.inputValidation.test.ts` exercise the full HTTP/controller stack (auth headers, `parseItems`, `assertValidImportStatusTransition` wiring inside `createImportOrder`/`updateImportOrder`) which the model-layer `receivingGate` test does not, and `stockTransaction.lotReference.test.ts` calls `createStockTransactionTx` directly per the plan's exact spec rather than through the `StockTransactionModel.create` wrapper. No code changes were needed since 03-05/03-02's implementation was already correct — all 14 tests passed first run.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1/2/3 auto-fixes were needed; all three test files passed on the first `vitest run` with the existing (unmodified) source code from 03-05 and 03-02.

## Issues Encountered
- Fresh worktree had no `node_modules` (ran `pnpm install`), no generated Prisma client (ran `npx prisma generate`), and no `apps/backend/.env` (copied from the main checkout, gitignored, same precedent as prior phase-3 plans).
- Worktree branch base was initially incorrect (based on an older commit, missing `03-05`'s merge and the post-merge FK teardown fix); corrected via `git reset --hard` to `0804bd4` per the `worktree_branch_check` step before any file edits.

## User Setup Required

None - no external service configuration required. Same `.env` gitignore caveat as prior phase-3 plans: any other clone/worktree needs `apps/backend/.env` with `DATABASE_URL`, `PORT`, `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL`, `ALLOWED_ORIGINS`.

## Next Phase Readiness
- STOCK-04, STOCK-05, and ENFORCE-05 (import order line items + status transitions) all now have dedicated, named automated test coverage at the file paths this plan's `must_haves.artifacts` specifies, satisfying any downstream plan that references these exact paths.
- The D-04 overselling bug now has an explicit HTTP-layer regression test in addition to 03-05's model-layer one — double coverage across both layers reduces the risk of a future regression slipping through either layer alone.
- `npx tsc --noEmit` shows 0 errors in the backend after adding these three files.
- No blockers for the orchestrator's post-wave merge; this plan touches only new test files with no overlap with 03-06 (frontend-only) or 03-07 (disjoint backend test files per the parallel-execution note).

---
*Phase: 03-backend-enforcement-lot-batch-stock-control*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: apps/backend/tests/importOrder.receivingLots.test.ts
- FOUND: apps/backend/tests/stockTransaction.lotReference.test.ts
- FOUND: apps/backend/tests/importOrder.inputValidation.test.ts
- FOUND commit: ac38701
- FOUND commit: 2e0acae
- FOUND commit: 91fd2d4
