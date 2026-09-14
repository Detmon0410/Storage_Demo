---
phase: 02-rbac-audit-logging
plan: 09
subsystem: api
tags: [rbac, audit-logging, express, prisma, vitest]

# Dependency graph
requires:
  - phase: 02-rbac-audit-logging
    provides: "plan 02-03's Category audit-wrap pattern (prisma.$transaction + AuditLogModel.record(tx,...)), plan 02-04's tx-injectable StockTransactionModel.create/delete(data, client), plan 02-06's GET-route permission gating on product/inventoryStock/stockTransaction"
provides:
  - "Audited, permission-gated create/update/delete on Product and InventoryStock"
  - "Audited, permission-gated create/delete on StockTransaction, routed through the tx-injected StockTransactionModel so the product.stockQty side effect stays atomic with the audit write"
  - "audit.crud.batchB.test.ts and rbac.enforcement.writes.batchB.test.ts covering both modules"
affects: [02-10, 03-backend-enforcement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Direct-tx audit wrap (plan 02-03 Category pattern) applied to Product/InventoryStock: prisma.$transaction(tx => tx.<entity>.create/update/delete + AuditLogModel.record(tx, ...))"
    - "Model-mediated audit wrap for entities whose model has side effects (StockTransaction): controller opens prisma.$transaction, passes tx into StockTransactionModel.create/delete(data, tx) so the model's internal product.stockQty adjustment and the controller's AuditLogModel.record(tx, ...) commit as one atomic unit"

key-files:
  created:
    - apps/backend/tests/audit.crud.batchB.test.ts
    - apps/backend/tests/rbac.enforcement.writes.batchB.test.ts
  modified:
    - apps/backend/src/controllers/product.controller.ts
    - apps/backend/src/controllers/inventoryStock.controller.ts
    - apps/backend/src/controllers/stockTransaction.controller.ts
    - apps/backend/src/routes/product.routes.ts
    - apps/backend/src/routes/inventoryStock.routes.ts
    - apps/backend/src/routes/stockTransaction.routes.ts

key-decisions:
  - "Product/InventoryStock controllers switched from calling their Model's create/update/delete to calling tx.<entity>.create/update/delete directly (matching plan 02-03's Category pattern), since both models are plain single-call wrappers with no internal transaction logic to preserve"
  - "StockTransaction controller kept calling StockTransactionModel.create/delete but now passes the outer prisma.$transaction's tx as the client argument, relying on plan 02-04's `\"$transaction\" in client` check to run the model's stockQty-adjusting logic directly on tx rather than opening a nested transaction"

patterns-established:
  - "For plain models (no side effects), audit-wrap by calling tx.<entity>.<verb> directly inside the controller's own prisma.$transaction"
  - "For models with side effects (stock adjustments, cascades), audit-wrap by opening prisma.$transaction in the controller and passing tx into the model's tx-injected create/update/delete, keeping the side effect and the audit row atomic"

requirements-completed: [RBAC-04, AUDIT-01]

duration: 45min
completed: 2026-09-14
---

# Phase 02 Plan 09: Product/InventoryStock/StockTransaction RBAC + Audit Summary

**Product, InventoryStock, and StockTransaction mutations are now permission-gated and atomically audited, with StockTransaction's stock-quantity side effect preserved inside the same transaction as its audit write.**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-09-14T06:15:00Z (approx, worktree setup + reads)
- **Completed:** 2026-09-14T06:59:50Z
- **Tasks:** 2/2
- **Files modified:** 6 (+ 2 new test files)

## Accomplishments
- Product and InventoryStock controllers' create/update/delete now run inside `prisma.$transaction`, writing an `AuditLogModel.record(tx, ...)` row alongside every mutation (matching plan 02-03's Category pattern)
- StockTransaction create/delete now call `StockTransactionModel.create(data, tx)` / `StockTransactionModel.delete(transactionId, tx)` from inside the controller's own transaction, so the model's `product.stockQty` increment/decrement commits atomically with both the transaction row and its audit row
- All 6 mutating routes across the 3 modules gated by their correct `*_CREATE`/`*_EDIT`/`*_DELETE` permission codes (already seeded in `prisma/seed.ts`); GET routes (wired in plan 02-06) left untouched
- New `audit.crud.batchB.test.ts` (3 tests) verifies Product create/update/delete audit rows and StockTransaction create/delete audit rows + correct `stockQty` adjustment
- New `rbac.enforcement.writes.batchB.test.ts` (5 tests) verifies permission enforcement: SALES_OFFICER denied on Product/StockTransaction create; WAREHOUSE_DISTRIBUTION_OFFICER allowed on InventoryStock/StockTransaction create but denied on Admin-only InventoryStock delete

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit-wrap + permission-gate product and inventoryStock controllers/routes** - `dc1f6f0` (feat)
2. **Task 2: Audit-wrap + permission-gate stockTransaction (via tx-injected model); tests** - `012c006` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified
- `apps/backend/src/controllers/product.controller.ts` - create/update/delete wrapped in `prisma.$transaction` with `AuditLogModel.record(tx, ...)`
- `apps/backend/src/controllers/inventoryStock.controller.ts` - same audit-wrap pattern
- `apps/backend/src/controllers/stockTransaction.controller.ts` - create/delete now open `prisma.$transaction` and call `StockTransactionModel.create/delete(data, tx)` plus `AuditLogModel.record(tx, ...)`
- `apps/backend/src/routes/product.routes.ts` - POST/PUT/DELETE gated by `PRODUCT_CREATE`/`PRODUCT_EDIT`/`PRODUCT_DELETE`
- `apps/backend/src/routes/inventoryStock.routes.ts` - POST/PUT/DELETE gated by `INVENTORY_CREATE`/`INVENTORY_EDIT`/`INVENTORY_DELETE`
- `apps/backend/src/routes/stockTransaction.routes.ts` - POST/DELETE gated by `STOCK_TRANSACTION_CREATE`/`STOCK_TRANSACTION_DELETE`
- `apps/backend/tests/audit.crud.batchB.test.ts` (new) - Product round-trip + StockTransaction create/delete audit + stockQty assertions
- `apps/backend/tests/rbac.enforcement.writes.batchB.test.ts` (new) - write-permission enforcement across all 3 modules

## Decisions Made
- Followed the plan's explicit interface guidance exactly: direct-`tx` calls for Product/InventoryStock (no model-level side effects), model-mediated calls for StockTransaction (has a `product.stockQty` side effect that must stay atomic with its audit row). No deviation from the plan's prescribed pattern was needed.

## Deviations from Plan

None - plan executed exactly as written. (One in-progress test-authoring correction: an early draft of the StockTransaction-delete audit test used `WAREHOUSE_DISTRIBUTION_OFFICER`, which per the seed data only has `STOCK_TRANSACTION_CREATE` not `STOCK_TRANSACTION_DELETE`; corrected to `SYSTEM_ADMIN` before committing. Caught and fixed pre-commit during test-writing, not a plan deviation.)

## Issues Encountered
- This worktree had no `node_modules` installed and no `apps/backend/.env` file; ran `pnpm install` + `pnpm --filter backend exec prisma generate` and copied `.env` from the main checkout (gitignored, not committed) to make `tsc`/`vitest` runnable.
- Full-suite `pnpm exec vitest run` showed 4 failures in `tests/audit.query.test.ts` and `tests/importOrder.license-block.test.ts` — neither file was touched by this plan. Verified both pass cleanly in isolation (7/7). This is the same pre-existing full-suite flakiness already logged in `deferred-items.md` from plan 02-06 (likely aggravated here by this wave's 3 parallel worktree executors sharing one test database); logged a recurrence note in `deferred-items.md` rather than fixing, per the scope-boundary rule.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Product, InventoryStock, and StockTransaction now match the audit + RBAC pattern established for Category (02-03) and rolled out to Import/Sales orders elsewhere in this phase (02-10 handles importOrder/salesOrder with their additional approval-workflow logic)
- No blockers for 02-10 or later phases; the tx-injection pattern demonstrated here (StockTransactionModel) is directly reusable for any future model with side effects that need atomic audit coverage

---
*Phase: 02-rbac-audit-logging*
*Completed: 2026-09-14*

## Self-Check: PASSED

All 8 files (6 modified controllers/routes, 2 new test files) and the SUMMARY.md exist on disk.
Both task commits (`dc1f6f0`, `012c006`) verified present in `git log`.
