---
phase: 03-backend-enforcement-lot-batch-stock-control
plan: 02
subsystem: backend
tags: [prisma, transactions, inventory, credit-limit, discount, guards]

# Dependency graph
requires:
  - phase: 03-backend-enforcement-lot-batch-stock-control
    plan: "01"
    provides: "SalesOrderItem.inventoryStockId FK, StockTransaction.inventoryStockId FK, roundHalfUp utility"
provides:
  - "assertLotQuantityTx(tx, items) — transaction-scoped hard-reject on insufficient lot quantity"
  - "suggestFifoLot(tx, productId) — advisory FIFO lot lookup by receivedDate"
  - "assertCreditAndDiscountTx(tx, customerId, items) — transaction-scoped soft-block credit/discount recomputation"
  - "createStockTransactionTx/reverseAndDeleteByReferenceTx now sync InventoryStock.quantityOnHand alongside Product.stockQty when inventoryStockId is present"
affects: [03-04, 03-05, 03-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Transaction-scoped guard functions (Prisma.TransactionClient) that re-read DB state and throw HttpError, matching licenseGate.ts's assertProductsNotBlockedTx shape"
    - "Soft-block pattern: guards that return a flag instead of throwing (assertCreditAndDiscountTx), contrasted with hard-reject guards (assertLotQuantityTx, assertProductsNotBlockedTx)"

key-files:
  created:
    - apps/backend/src/utils/lotGate.ts
    - apps/backend/src/utils/creditDiscountGate.ts
    - apps/backend/tests/lotGate.test.ts
    - apps/backend/tests/creditDiscountGate.test.ts
    - apps/backend/tests/stockTransaction.inventoryStock.test.ts
  modified:
    - apps/backend/src/models/stockTransaction.model.ts

key-decisions:
  - "Followed the plan's exact code as specified in <action> blocks (interfaces matched the codebase's current file shapes exactly, verified via Read before writing)"
  - "Pre-existing salesOrder.model.ts breakage from 03-01's schema migration (still using old lotBatch field) left unfixed — out of scope for this plan's files (lotGate.ts, creditDiscountGate.ts, stockTransaction.model.ts); logged to deferred-items.md, expected to be resolved by 03-04-PLAN.md per this plan's own objective statement"

requirements-completed: [ENFORCE-02, ENFORCE-03, ENFORCE-04, STOCK-01, STOCK-02, STOCK-03, STOCK-05]

# Metrics
duration: 24min
completed: 2026-09-15
---

# Phase 3 Plan 02: Enforcement Guards & InventoryStock Sync Summary

**Built the two transaction-scoped guard functions (`assertLotQuantityTx` hard-reject, `assertCreditAndDiscountTx` soft-block) that all later sales/import enforcement plans import, and extended `stockTransaction.model.ts` to keep `InventoryStock.quantityOnHand` in sync with `Product.stockQty` inside the same transaction.**

## Performance

- **Duration:** 24 min
- **Started:** 2026-09-15T07:19:47Z (approx, worktree base-correction preceded this)
- **Completed:** 2026-09-15T07:43:47Z
- **Tasks:** 3
- **Files modified:** 6 (3 source files created/modified, 3 test files created)

## Accomplishments
- `apps/backend/src/utils/lotGate.ts`: `assertLotQuantityTx` re-reads `InventoryStock.quantityOnHand` inside the caller's transaction and hard-rejects (`HttpError(400)`, message contains "insufficient") on overdraw, or `HttpError(404)` on a missing lot; `suggestFifoLot` returns the oldest available lot by `receivedDate` (advisory only, not called from any guard)
- `apps/backend/src/utils/creditDiscountGate.ts`: `assertCreditAndDiscountTx` recomputes `orderNetValue` from raw item fields (`quantity`, `unitPrice`, `discount`, `taxRate`) via `roundHalfUp`, never trusting a client-submitted total, and returns `{ requiresApproval: boolean }` without throwing on overage (only throws `HttpError(404)` for a missing customer)
- `apps/backend/src/models/stockTransaction.model.ts`: `createStockTransactionTx` and `reverseAndDeleteByReferenceTx` now conditionally increment/decrement the linked `InventoryStock.quantityOnHand` in the same transaction as `Product.stockQty`, gated on the new optional `inventoryStockId` field — existing callers without it are unaffected

## Task Commits

Each task followed RED/GREEN TDD and was committed atomically:

1. **Task 1: lotGate.ts** - test: `c0d9502`, feat: `0a5e305`
2. **Task 2: creditDiscountGate.ts** - test: `abab6d7`, feat: `7c19049`
3. **Task 3: stockTransaction.model.ts InventoryStock sync** - test: `3131a4b`, feat: `cfeca10`

## Files Created/Modified
- `apps/backend/src/utils/lotGate.ts` - New: `assertLotQuantityTx`, `suggestFifoLot`
- `apps/backend/src/utils/creditDiscountGate.ts` - New: `assertCreditAndDiscountTx`
- `apps/backend/src/models/stockTransaction.model.ts` - Added `inventoryStockId?: number` to `StockTransactionInput`; both create and reverse paths now sync the linked lot
- `apps/backend/tests/lotGate.test.ts` - New: 6 tests covering within/exceed/missing-lot/empty-items for `assertLotQuantityTx`, and FIFO/no-lots for `suggestFifoLot`
- `apps/backend/tests/creditDiscountGate.test.ts` - New: 5 tests covering ok/over-credit/over-discount/missing-customer
- `apps/backend/tests/stockTransaction.inventoryStock.test.ts` - New: 4 tests covering IN increment, OUT decrement, omitted-field no-op, and reversal restoration

## Decisions Made
- Implemented all three files exactly as specified in the plan's `<action>` blocks after verifying (via `Read`) that the plan's "current file" interface excerpts matched the actual codebase state — no deviation needed.
- Wrote new TDD test files for each guard/behavior since none existed yet (`tests/lotGate.test.ts`, `tests/creditDiscountGate.test.ts`, `tests/stockTransaction.inventoryStock.test.ts`), following the existing `tests/licenseGate.test.ts` pattern (real Prisma DB, `$transaction` wrapper, cleanup in `afterAll`).

## Deviations from Plan

None - plan executed exactly as written. The one out-of-scope discovery (below) was not fixed, per the executor's scope-boundary rule.

## Known Stubs

None. `suggestFifoLot` is intentionally an advisory-only helper not yet wired into any lookup endpoint — this matches the plan's explicit note that wiring happens in "whichever plan needs to expose it," not this one.

## Out-of-Scope Discovery (Deferred, Not Fixed)

`apps/backend/src/models/salesOrder.model.ts` (lines ~115, ~174) still constructs `SalesOrderItem` create data using the old free-text `lotBatch` field, which 03-01-PLAN.md's schema migration replaced with a required `inventoryStockId` FK. This causes:
- `npx tsc --noEmit` to report 2 pre-existing errors in `salesOrder.model.ts` (both present before this plan's changes, unrelated to `lotGate.ts`/`creditDiscountGate.ts`/`stockTransaction.model.ts`)
- One test in the pre-existing `tests/models.txClient.test.ts` suite ("SalesOrderModel.create with no client arg still works...") to fail with a Prisma validation error (`Argument \`product\` is missing`)

Verified this is pre-existing (not caused by this plan): ran `tests/models.txClient.test.ts` before touching any files and observed the identical 1-failed/3-passed baseline. 03-01-SUMMARY.md already flagged this exact issue as expected to be addressed by a later plan. Logged to `.planning/phases/03-backend-enforcement-lot-batch-stock-control/deferred-items.md`. Expected to be resolved by 03-04-PLAN.md (sales order enforcement wiring), which per this plan's own objective is responsible for wiring `inventoryStockId` into `salesOrder.model.ts`.

## Issues Encountered
- Fresh worktree had no `node_modules` (ran `pnpm install`) and no `apps/backend/.env` (copied from the main checkout, gitignored, same precedent as 03-01-SUMMARY.md).
- `npx prisma migrate status` confirmed the worktree's DB already matched the 10-migration history left by 03-01 — no new migration work needed for this plan (it touches no schema).

## User Setup Required

None - no external service configuration required. Same `.env` gitignore caveat as 03-01: any other clone/worktree needs `apps/backend/.env` with `DATABASE_URL`, `PORT`, `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL`, `ALLOWED_ORIGINS`.

## Next Phase Readiness
- `assertLotQuantityTx`, `suggestFifoLot`, and `assertCreditAndDiscountTx` are importable and ready for 03-04/03-05 (sales/import order model wiring) to call inside their own `$transaction` blocks
- `StockTransactionModel.create`/`delete` and the two `*Tx` helper functions now flow `inventoryStockId` through automatically once callers start passing it — no further changes needed to `stockTransaction.model.ts` itself
- Flag for the orchestrator/next plans: `salesOrder.model.ts`'s `lotBatch`-vs-`inventoryStockId` mismatch (see Out-of-Scope Discovery above) blocks full green `tsc`/`models.txClient.test.ts` until 03-04 wires it in — this is expected, not a regression introduced here

---
*Phase: 03-backend-enforcement-lot-batch-stock-control*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: apps/backend/src/utils/lotGate.ts
- FOUND: apps/backend/src/utils/creditDiscountGate.ts
- FOUND: apps/backend/src/models/stockTransaction.model.ts
- FOUND: apps/backend/tests/lotGate.test.ts
- FOUND: apps/backend/tests/creditDiscountGate.test.ts
- FOUND: apps/backend/tests/stockTransaction.inventoryStock.test.ts
- FOUND: .planning/phases/03-backend-enforcement-lot-batch-stock-control/deferred-items.md
- FOUND commit: c0d9502
- FOUND commit: 0a5e305
- FOUND commit: abab6d7
- FOUND commit: 7c19049
- FOUND commit: 3131a4b
- FOUND commit: cfeca10
