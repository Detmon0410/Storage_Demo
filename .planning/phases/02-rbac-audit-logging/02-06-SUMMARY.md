---
phase: 02-rbac-audit-logging
plan: 06
subsystem: backend
tags: [express, rbac, middleware, vitest]

# Dependency graph
requires:
  - phase: 02-rbac-audit-logging
    plan: 02
    provides: requirePermission(code) middleware, RoleModel permission-union query, createTestUserWithRoles fixture
provides:
  - "PRODUCT_VIEW/INVENTORY_VIEW/IMPORT_ORDER_VIEW/SALES_ORDER_VIEW/STOCK_TRANSACTION_VIEW enforcement on all 5 modules' GET routes"
  - "rbac.enforcement.reads.batchB.test.ts — parameterized proof that SALES_OFFICER is denied IMPORT_ORDER_VIEW while granted on the other 4 modules"
affects: [02-05 (sibling batch-A read-permission plan), later write-permission plans on the same 5 route files]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "requirePermission(\"<MODULE>_VIEW\") inserted immediately after requireAuth on GET / and GET /:id only; POST/PUT/DELETE left untouched (paired write-permission rollout deferred to a later plan)"

key-files:
  created:
    - apps/backend/tests/rbac.enforcement.reads.batchB.test.ts
  modified:
    - apps/backend/src/routes/product.routes.ts
    - apps/backend/src/routes/inventoryStock.routes.ts
    - apps/backend/src/routes/importOrder.routes.ts
    - apps/backend/src/routes/salesOrder.routes.ts
    - apps/backend/src/routes/stockTransaction.routes.ts

key-decisions:
  - "This worktree required a fresh pnpm install, prisma generate, and a copied .env (all gitignored) before any command would run — same as prior Phase 02 plans."

requirements-completed: [RBAC-04]

# Metrics
duration: 20min
completed: 2026-09-14
---

# Phase 02 Plan 06: RBAC Read-Permission Rollout — Batch B (product/inventoryStock/importOrder/salesOrder/stockTransaction) Summary

**Wired `requirePermission("<MODULE>_VIEW")` onto the GET routes of the second batch of 5 route files, mirroring plan 02-05's batch A, with a parameterized `it.each` test proving the IMPORT_ORDER_VIEW exclusion for SALES_OFFICER.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-09-14 (after worktree base correction + environment setup)
- **Completed:** 2026-09-14
- **Tasks:** 2
- **Files modified:** 6 (5 route files, 1 new test file)

## Accomplishments

- Added `requirePermission("PRODUCT_VIEW")` to `product.routes.ts`'s `GET /` and `GET /:id`
- Added `requirePermission("INVENTORY_VIEW")` to `inventoryStock.routes.ts`'s `GET /` and `GET /:id`
- Added `requirePermission("STOCK_TRANSACTION_VIEW")` to `stockTransaction.routes.ts`'s `GET /` and `GET /:id` (this file has no `PUT /:id` route, confirmed unchanged)
- Added `requirePermission("IMPORT_ORDER_VIEW")` to `importOrder.routes.ts`'s `GET /` and `GET /:id` — this permission code is seeded to exclude `SALES_OFFICER` per the role matrix
- Added `requirePermission("SALES_ORDER_VIEW")` to `salesOrder.routes.ts`'s `GET /` and `GET /:id`
- Left all POST/PUT/DELETE routes on all 5 files with `requireAuth` only, unchanged
- Wrote `rbac.enforcement.reads.batchB.test.ts` using `describe.each`/`it` over the 5 `{path, allowedRole, deniedRole?}` cases specified in the plan; the `import-orders` case additionally proves `SALES_OFFICER` gets exactly 403 (mitigates threat T-02-12)
- Verified all 5 permission codes exist in `prisma/seed.ts` with the expected role assignments before wiring
- `npx tsc --noEmit` passes with zero errors after both tasks
- Target test file passes: 6 tests run, 4 skipped (no `deniedRole` case for products/inventory-stocks/sales-orders/stock-transactions, matching the plan's intent that only `import-orders` has a denied-role case)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire *_VIEW permission onto product, inventoryStock, stockTransaction GET routes** - `c1d3ee5` (feat)
2. **Task 2: Wire *_VIEW permission onto importOrder, salesOrder GET routes; parameterized test** - `8af9aed` (feat)

## Files Created/Modified

- `apps/backend/src/routes/product.routes.ts` - `requirePermission("PRODUCT_VIEW")` on both GET routes
- `apps/backend/src/routes/inventoryStock.routes.ts` - `requirePermission("INVENTORY_VIEW")` on both GET routes
- `apps/backend/src/routes/stockTransaction.routes.ts` - `requirePermission("STOCK_TRANSACTION_VIEW")` on both GET routes
- `apps/backend/src/routes/importOrder.routes.ts` - `requirePermission("IMPORT_ORDER_VIEW")` on both GET routes
- `apps/backend/src/routes/salesOrder.routes.ts` - `requirePermission("SALES_ORDER_VIEW")` on both GET routes
- `apps/backend/tests/rbac.enforcement.reads.batchB.test.ts` - new, parameterized `describe.each` proving allowed-role non-403 across all 5 modules and denied-role 403 for the `import-orders` case

## Decisions Made

- Environment setup: ran `pnpm install`, `npx prisma generate`, and copied the gitignored `apps/backend/.env` from the main checkout — this worktree had none of these (fresh worktree checkout), consistent with prior Phase 02 plans' environment-setup notes.

## Deviations from Plan

None — plan executed exactly as written. No architectural changes, no bugs found in the 5 route files being wired, no missing critical functionality beyond what the plan specified.

## Issues Encountered

- Worktree branch initially based on a stale commit (`git merge-base` mismatch against the required base `91d6f698e6937cd5da18f86016e1f4f0c898d961`); corrected via `git reset --hard` to the required base before any work began (working tree was clean, no data at risk).
- Full backend suite (`pnpm exec vitest run`, all ~97 tests) shows intermittent, non-reproducible failures in files unrelated to this plan's changes (`salesOrder.license-block.test.ts` in one run, `auth.hashing.test.ts` in another run) — both pass cleanly in isolation. This is pre-existing cross-file test-order flakiness (likely shared rate-limiter or DB-timing state), not a regression introduced by this plan. Logged to `deferred-items.md` per the scope-boundary rule; not fixed as part of this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 10 read-heavy route files (5 from plan 02-05, 5 from this plan) now enforce `*_VIEW` permissions on their GET routes, completing the staged read-permission rollout mandated by RESEARCH.md Pattern 3.
- Write-permission enforcement (POST/PUT/DELETE) on these same 5 files remains for a later plan, as intended by the staged rollout.
- The pre-existing full-suite test flakiness (documented in `deferred-items.md`) should be addressed before or during the next plan that runs the full suite as its primary verification gate, to avoid false-positive failure attribution.

---
*Phase: 02-rbac-audit-logging*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: apps/backend/src/routes/product.routes.ts
- FOUND: apps/backend/src/routes/inventoryStock.routes.ts
- FOUND: apps/backend/src/routes/stockTransaction.routes.ts
- FOUND: apps/backend/src/routes/importOrder.routes.ts
- FOUND: apps/backend/src/routes/salesOrder.routes.ts
- FOUND: apps/backend/tests/rbac.enforcement.reads.batchB.test.ts
- FOUND commit: c1d3ee5 (feat: batch B part 1 — product/inventoryStock/stockTransaction)
- FOUND commit: 8af9aed (feat: batch B part 2 — importOrder/salesOrder + test)
