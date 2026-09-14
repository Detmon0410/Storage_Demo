---
phase: 02-rbac-audit-logging
plan: 04
subsystem: models
tags: [prisma, transactions, refactor, vitest]

# Dependency graph
requires:
  - phase: 02-rbac-audit-logging
    plan: 01
    provides: createdById field on ImportOrder/SalesOrder
provides:
  - Injectable-tx-client signature on ImportOrderModel.create/update/delete
  - Injectable-tx-client signature on SalesOrderModel.create/update/delete
  - Injectable-tx-client signature on StockTransactionModel.create/delete
  - Injectable-tx-client signature on CustomerLicenseModel.renew
affects: [02-10 (import/sales order write+audit wrap controller)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "type Client = PrismaClient | Prisma.TransactionClient; optional trailing client param defaulting to the module's prisma singleton"
    - "\"$transaction\" in client ? client.$transaction((tx) => run(tx)) : run(client) — distinguishes an already-open TransactionClient (no $transaction method) from the singleton, joining the caller's transaction instead of nesting a second one"

key-files:
  created:
    - apps/backend/tests/models.txClient.test.ts
  modified:
    - apps/backend/src/models/importOrder.model.ts
    - apps/backend/src/models/salesOrder.model.ts
    - apps/backend/src/models/stockTransaction.model.ts
    - apps/backend/src/models/customerLicense.model.ts

key-decisions:
  - "Unified SalesOrderModel.update's two code paths (items vs no-items) under a single outer run() wrapper so there is exactly one \"$transaction\" in client check per method, matching the create/delete pattern and the plan's acceptance criteria (grep -c returns 3, not 4)"
  - "Added createdById?: number to ImportOrderModel.create and SalesOrderModel.create data params, passed through to the tx.*.create() call, for the no-self-approval check planned in 02-10"

patterns-established:
  - "Model-layer functions that internally open prisma.$transaction now uniformly accept an optional trailing client: PrismaClient | Prisma.TransactionClient = prisma parameter so controller-opened transactions (02-10) can call them without triggering Prisma's no-nested-transactions restriction"

requirements-completed: [AUDIT-01]

# Metrics
duration: 45min
completed: 2026-09-14
---

# Phase 02 Plan 04: Injectable Transaction Client for Order/Stock/License Models Summary

**Refactored ImportOrderModel, SalesOrderModel, StockTransactionModel, and CustomerLicenseModel.renew to accept an optional external Prisma transaction client, so a future controller-opened transaction (plan 02-10) can call these models without triggering a nested-transaction bug that would silently break AUDIT-01's atomicity guarantee.**

## Performance

- **Duration:** 45 min
- **Started:** 2026-09-14T02:30:00Z (approx)
- **Completed:** 2026-09-14T03:14:37Z
- **Tasks:** 2
- **Files modified:** 4 (+1 test file created)

## Accomplishments
- Added `type Client = PrismaClient | Prisma.TransactionClient` alias to all four model files
- Refactored `ImportOrderModel.create/update/delete` and `SalesOrderModel.create/update/delete` to accept a trailing optional `client` param, wrapping each transaction body in an inner `run(tx)` function and opening a transaction only when the singleton (not an already-open tx) is passed
- Added `createdById?: number` to `ImportOrderModel.create` and `SalesOrderModel.create` data params, threaded through to the underlying `tx.*.create()` call
- Applied the identical wrapper to `StockTransactionModel.create/delete` (its internal tx-first helpers `createStockTransactionTx`/`reverseAndDeleteByReferenceTx` already accepted `tx` as their first argument and needed no change) and to `CustomerLicenseModel.renew` (its only method with an internal `$transaction`)
- Unified `SalesOrderModel.update`'s two branches (with/without `items`) under one outer `run()` so there is a single `"$transaction" in client` check per method, consistent with the other methods
- Wrote `apps/backend/tests/models.txClient.test.ts` with 4 regression assertions: standalone `ImportOrderModel.create` still creates the order + linked IN stock transaction; standalone `SalesOrderModel.create` still works against a seeded customer+license+product and creates an OUT stock transaction; standalone `StockTransactionModel.create` still updates `product.stockQty`; and an explicit `prisma.$transaction(tx => ImportOrderModel.create(data, tx))` call from the test resolves successfully, proving the tx-injection path joins the caller's transaction instead of nesting
- Verified `npx tsc --noEmit -p apps/backend` passes cleanly after each task
- Verified the full backend test suite (72 tests across 16 files, including the pre-existing `importOrder.license-block.test.ts` and `salesOrder.license-block.test.ts` HTTP-level tests) passes with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Refactor importOrder.model.ts and salesOrder.model.ts for injectable tx client** - `7e549d2` (feat)
2. **Task 2: Refactor stockTransaction.model.ts + customerLicense.model.ts renew; regression test** - `aa4af2f` (feat)

## Files Created/Modified
- `apps/backend/src/models/importOrder.model.ts` - `create/update/delete` accept optional `client: Client = prisma`; `create` accepts `createdById?: number`
- `apps/backend/src/models/salesOrder.model.ts` - `create/update/delete` accept optional `client: Client = prisma`; `create` accepts `createdById?: number`; `update`'s two branches unified under one `run()`
- `apps/backend/src/models/stockTransaction.model.ts` - top-level `create`/`delete` accept optional `client: Client = prisma`; internal tx-first helpers unchanged
- `apps/backend/src/models/customerLicense.model.ts` - `renew` accepts optional `client: Client = prisma`; `create`/`update`/`delete`/`findAll`/`findById`/`isLicenseValid` untouched (no internal transaction to conflict with)
- `apps/backend/tests/models.txClient.test.ts` - 4 vitest assertions proving standalone behavior is unchanged and the tx-injection path is reachable without nesting

## Decisions Made
- Unified `SalesOrderModel.update`'s items/no-items branches under a single outer `run()` wrapper (rather than two separate `"$transaction" in client` checks) to match the plan's acceptance criteria of exactly 3 occurrences per file and keep the pattern consistent with `create`/`delete`.
- Added `createdById?: number` to both `ImportOrderModel.create` and `SalesOrderModel.create` per the plan's interface spec, even though no caller passes it yet — it exists on the schema (from 02-01) and is needed by plan 02-10's no-self-approval check.

## Deviations from Plan

None - plan executed exactly as written. The one implementation refinement (unifying `SalesOrderModel.update`'s two branches into a single `run()`) was a direct consequence of matching the plan's explicit acceptance criterion (`grep -c` returns `3`) and is not a scope change.

## Issues Encountered
- This worktree lacked installed dependencies and a `.env` file (expected in a fresh git worktree, since `node_modules` and `.env` are gitignored) and the Prisma client build scripts were not yet approved. Resolved by running `pnpm install`, copying `apps/backend/.env` from the main checkout, and running `npx prisma generate` directly (the interactive `pnpm approve-builds` prompt could not be scripted, so `prisma generate` was invoked directly instead — the RBAC schema itself was already pushed to the shared dev DB by plan 02-01, so no `db push` was needed here). No plan or code changes were required to resolve this — purely local environment setup.

## User Setup Required

None - no external service configuration required. This is a pure model-layer refactor against the existing shared dev database.

## Next Phase Readiness
- All four models with internal `prisma.$transaction` calls now uniformly support an injected `Prisma.TransactionClient`, unblocking plan 02-10 (which will open its own controller-level transaction, write the audit log, and call these models from inside it) without risking Prisma's nested-transaction restriction.
- `createdById` is now accepted by `ImportOrderModel.create`/`SalesOrderModel.create` (still optional, still nullable on existing rows) for the no-self-approval check planned in 02-10.
- No blockers identified for later plans in this phase.

---
*Phase: 02-rbac-audit-logging*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: apps/backend/src/models/importOrder.model.ts
- FOUND: apps/backend/src/models/salesOrder.model.ts
- FOUND: apps/backend/src/models/stockTransaction.model.ts
- FOUND: apps/backend/src/models/customerLicense.model.ts
- FOUND: apps/backend/tests/models.txClient.test.ts
- FOUND commit: 7e549d2 (feat: injectable tx client for import/sales order models)
- FOUND commit: aa4af2f (feat: injectable tx client for stock transaction / customer license renew + regression test)
