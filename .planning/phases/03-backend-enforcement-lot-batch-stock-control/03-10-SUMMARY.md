---
phase: 03-backend-enforcement-lot-batch-stock-control
plan: 10
subsystem: database
tags: [prisma, seed, lot-batch, demo-data, verification]

# Dependency graph
requires:
  - phase: 03-backend-enforcement-lot-batch-stock-control
    plan: "01"
    provides: "SalesOrderItem.inventoryStockId FK (replaces lotBatch string)"
  - phase: 03-backend-enforcement-lot-batch-stock-control
    plan: "04"
    provides: "salesOrder.model.ts wired to inventoryStockId end-to-end"
  - phase: 03-backend-enforcement-lot-batch-stock-control
    plan: "05"
    provides: "RECEIVED-gated InventoryStock lot creation in importOrder.model.ts"
  - phase: 03-backend-enforcement-lot-batch-stock-control
    plan: "09"
    provides: "confirmation that all pre-existing test files already migrated off SalesOrderItem.lotBatch"
provides:
  - "prisma/seed.ts reordered so InventoryStock lots exist before SalesOrder rows reference them by inventoryStockId FK"
  - "Full backend demo dataset regenerates cleanly against the fully-migrated Phase 3 schema"
  - "Confirmed full backend test suite (52 files / 224 tests) green end-to-end"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "lotIdByKey lookup map (productCode::lotBatch -> inventoryStockId), populated at InventoryStock seed-creation time and consumed by both the bulk SalesOrder seed loop and the model-layer showcase order"

key-files:
  created: []
  modified:
    - apps/backend/prisma/seed.ts

key-decisions:
  - "Confirmed (per 03-01-SUMMARY.md's flagged concern) that seed.ts's own main() unconditionally deletes all business-demo tables in a $transaction before reseeding, so the earlier backfill-instead-of-wipe decision from 03-01 has no bearing on this plan: running npm run db:seed always starts from a clean slate regardless of pre-existing DB state"
  - "Task 2 required zero fixes — the full suite was already green going into this plan, confirming 03-04/03-05/03-09's prior work fully closed out the lotBatch -> inventoryStockId migration across both source and test code"

requirements-completed: [STOCK-01, STOCK-04]

# Metrics
duration: 25min
completed: 2026-09-15
---

# Phase 3 Plan 10: Seed Data Migration & Final Test Suite Verification Summary

**Reordered `prisma/seed.ts` so inventory lots are created before the sales orders that reference them via the `inventoryStockId` FK, replacing every `lotBatch` string reference with a resolved lot lookup, and confirmed the full backend test suite (52 files, 224 tests, 0 failures) passes against the fully-migrated Phase 3 schema — closing out the phase.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-15T07:55:00Z (approx, after worktree base-correction and environment setup)
- **Completed:** 2026-09-15T08:23:11Z
- **Tasks:** 2
- **Files modified:** 1 (`apps/backend/prisma/seed.ts`)

## Accomplishments

- `prisma/seed.ts`'s `inventoryStocks` creation loop now runs immediately after `importOrders` (and before `salesOrders`), building a `lotIdByKey` map (`${productCode}::${lotBatch}` -> `inventoryStockId`) as each lot is created
- Every `salesOrders` item row now resolves a real `inventoryStockId` via that map instead of writing a free-text `lotBatch` string; a lookup miss throws a clear, named error (`orderNo`/`productCode`/`lotBatch`) instead of producing a cryptic Prisma FK violation (T-03-25 mitigation)
- The end-of-`main()` model-layer showcase `SalesOrderModel.create` call was updated the same way: a dedicated `InventoryStock` row is created for `SKU-1012`'s `LOT-A2608-05` (not part of the bulk `inventoryStocks` array) immediately before the showcase order, and both its items now pass `inventoryStockId`
- Removed the old, now-redundant `inventoryStocks` creation loop that previously ran after `salesOrders` (data/loop body unchanged, only its position moved)
- `npm run db:seed` runs clean end-to-end against the fully-migrated schema
- Full backend test suite (`npm test`) is green: 52 test files, 224 passed, 9 skipped (pre-existing conditional `it.skip` for permission test cases with no `deniedRole`, not newly added), 0 failed — no fixes were required, confirming 03-04/03-05/03-09's prior work already fully closed the `lotBatch` -> `inventoryStockId` migration

## Task Commits

Each task was committed atomically:

1. **Task 1: Reorder seed.ts — create inventory lots before sales orders, convert lotBatch strings to inventoryStockId lookups, gate import-order stock creation to RECEIVED** - `9974d37` (feat)
2. **Task 2 [BLOCKING]: Full backend test suite verification** - no code changes required; verification-only, see below

## Files Created/Modified

- `apps/backend/prisma/seed.ts` - `inventoryStocks` block moved ahead of `salesOrders`; new `lotIdByKey` lookup map; `salesOrders` item rows and the showcase `SalesOrderModel.create` call now use `inventoryStockId` instead of `lotBatch`; dedicated `InventoryStock` row added for the showcase order's `SKU-1012`/`LOT-A2608-05` lot

## Decisions Made

- Re-verified 03-01-SUMMARY.md's flagged assumption about starting DB state before assuming a clean slate: `seed.ts`'s own `main()` runs an unconditional `$transaction` of `deleteMany()` calls across every business-demo table (`stockTransaction`, `salesOrderItem`, `salesOrder`, `customerLicense`, `inventoryStock`, `importOrderItem`, `importOrder`, `customer`, `license`, `company`, `product`, `supplier`, `category`, `dashboardKpi`) before any inserts happen. This means `npm run db:seed` always starts from a clean slate regardless of what 03-01's backfill-instead-of-wipe decision left in the database — the flagged concern does not apply to this plan's own execution, and no special handling was needed.
- No code changes were needed for Task 2 (full suite verification) — the suite was already green. This confirms the assumption in 03-09-SUMMARY.md (that 03-04's in-flight fixes to the 6 pre-existing test files already closed out the migration) held all the way through to this final wave.

## Deviations from Plan

None — plan executed exactly as written. Task 1's `<action>` steps 1-6 were all followed literally (position move, `lotIdByKey` map, salesOrders item mapping, showcase-block update, RECEIVED-status confirmation, `importOrders` block left untouched). Task 2 required no fixes since the suite was already green.

## Known Stubs

None.

## Threat Flags

None — this plan's only new surface (the `lotIdByKey.get(...)` lookup-miss error path) is explicitly the T-03-25 mitigation already covered by this plan's own `<threat_model>`.

## Issues Encountered

- Fresh worktree had no `node_modules` (ran `pnpm install` at the repo root), no generated Prisma client (`node_modules/.bin/prisma generate`), and no `apps/backend/.env` (copied from the main checkout, gitignored, same precedent as prior 03-* plans).
- `npx prisma` on `PATH` resolved to a globally-cached Prisma 7.10.0 (which rejects the project's Prisma 6-style `datasource { url = env(...) }` schema syntax with error P1012); used the project-local `apps/backend/node_modules/.bin/prisma` (v6.19.3, matching `package.json`'s `^6.4.1` pin) for all Prisma CLI commands instead.
- Worktree's initial branch base was incorrect (based on an unrelated commit history); corrected via `git reset --hard baee65e2a1c25ab07e438cc46090651c3283f796` per the `worktree_branch_check` step before any file edits — worktree was clean (no uncommitted changes) so this was safe.
- `npx prisma migrate status` confirmed the worktree's DB already matched the 10-migration history left by prior waves — no schema work needed for this plan.

## User Setup Required

None - no external service configuration required. Same `.env` gitignore caveat as prior 03-* plans: any other clone/worktree needs `apps/backend/.env` with `DATABASE_URL`, `PORT`, `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL`, `ALLOWED_ORIGINS`.

## Next Phase Readiness

- Phase 3 is functionally complete: all 12 requirement IDs (`ENFORCE-01`..`06`, `STOCK-01`..`06`) are implemented and tested per prior plans' `requirements-completed` frontmatter, the schema migration is fully applied, and the demo seed data now reflects the new lot-based reality end-to-end (no remaining `SalesOrderItem.lotBatch` references anywhere in source or test code)
- `npm run db:seed` and `npm test` both exit 0 from a fresh worktree state, confirming Phase 3's exit criterion is met
- Marked `STOCK-04` complete in `.planning/REQUIREMENTS.md` (checkbox only — `STOCK-01` was already checked by an earlier plan); the traceability table's per-requirement status column (still showing "Pending" for several already-checked Phase 3 requirements) was left untouched, matching the existing pattern for `STOCK-01`/`02`/`03`, which is out of this plan's scope to reconcile

---
*Phase: 03-backend-enforcement-lot-batch-stock-control*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: apps/backend/prisma/seed.ts
- FOUND commit: 9974d37
- FOUND: .planning/phases/03-backend-enforcement-lot-batch-stock-control/03-10-SUMMARY.md
