---
phase: 03-backend-enforcement-lot-batch-stock-control
plan: 03
subsystem: backend
tags: [inventory, audit-log, rbac, express, prisma]

# Dependency graph
requires:
  - phase: 03-backend-enforcement-lot-batch-stock-control
    plan: 01
    provides: InventoryStock schema, corrected migration history
provides:
  - "adjustStockTx (model-layer signed-delta stock adjustment with negative-quantity guard)"
  - "POST /api/inventory-stocks/:id/adjust (reason-coded, audited, INVENTORY_ADJUST-gated)"
  - "INVENTORY_ADJUST permission (SYSTEM_ADMIN, WAREHOUSE_DISTRIBUTION_OFFICER)"
affects: [03-04, 03-05, 03-06, 03-07, 03-08, 03-09, 03-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reason-coded stock adjustment: fixed TypeScript union validated server-side, persisted into AuditLog.before JSON (no new schema column) — audit-log-first pattern from Phase 2"
    - "Defense in depth: field removed from both the model's update() writable-field type and the controller's destructure/data object"

key-files:
  created:
    - apps/backend/tests/inventoryStock.adjustment.test.ts
  modified:
    - apps/backend/src/models/inventoryStock.model.ts
    - apps/backend/src/controllers/inventoryStock.controller.ts
    - apps/backend/src/routes/inventoryStock.routes.ts
    - apps/backend/prisma/seed.ts

key-decisions:
  - "reasonCode modeled as a fixed TypeScript union validated in-controller, not a new Prisma enum/column — persisted inside AuditLog.before JSON, matching 03-01's explicit decision to avoid a new migration for this"

requirements-completed: [STOCK-06]

# Metrics
duration: 22min
completed: 2026-09-15
---

# Phase 3 Plan 03: Audited Stock Adjustment (D-06) Summary

**Closed the direct-manual-edit gap on `InventoryStock.quantityOnHand`: removed it from the generic PUT endpoint's writable fields at both model and controller layers, and added a dedicated `POST /:id/adjust` endpoint gated by a new `INVENTORY_ADJUST` permission that records a reason code and before/after snapshot in the audit log.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-09-15T14:35:00Z (approx, worktree-local)
- **Completed:** 2026-09-15
- **Tasks:** 3
- **Files modified:** 4 (model, controller, routes, seed) + 1 created (test)

## Accomplishments
- `adjustStockTx(tx, { inventoryStockId, delta, reasonCode, note })` in `inventoryStock.model.ts`: signed-delta increment/decrement with a hard guard against negative resulting quantity (`HttpError(400)`), and `HttpError(404)` for a nonexistent lot
- `InventoryStockModel.update()`'s `Partial<{...}>` type and Prisma `data:` object no longer mention `quantityOnHand` at all — model-layer enforcement independent of the controller
- `adjustInventoryStock` controller action: validates `delta` (required, non-zero) and `reasonCode` (fixed allow-list) server-side, wraps `adjustStockTx` + `AuditLogModel.record` in a single `prisma.$transaction`, persists `reasonCode`/`note` inside the audit log's `before` JSON snapshot
- `POST /api/inventory-stocks/:id/adjust` route added, gated by `requirePermission("INVENTORY_ADJUST")`
- `updateInventoryStock` controller action no longer destructures or writes `quantityOnHand` (belt-and-suspenders with the model-layer removal)
- `INVENTORY_ADJUST` permission seeded for `SYSTEM_ADMIN` and `WAREHOUSE_DISTRIBUTION_OFFICER`, confirmed live in the dev database (permission row + both role assignments queried directly)
- `apps/backend/tests/inventoryStock.adjustment.test.ts` created with 5 passing scenarios covering: successful reason-coded adjustment + audit log entry, negative-quantity rejection, invalid reasonCode rejection, 403 for a non-`INVENTORY_ADJUST` caller, and confirmation that a direct `PUT` with `quantityOnHand` in the body leaves the persisted value unchanged

## Task Commits

Each task was committed atomically:

1. **Task 1: Add adjustStockTx to inventoryStock.model.ts, remove quantityOnHand from update()'s writable fields** - `fa590e9` (feat)
2. **Task 2: Add adjustInventoryStock controller + POST /:id/adjust route + INVENTORY_ADJUST permission** - `475afa8` (feat)
3. **Task 3: Write inventoryStock.adjustment.test.ts (STOCK-06 coverage)** - `4553149` (test)

## Files Created/Modified
- `apps/backend/src/models/inventoryStock.model.ts` - Added `adjustStockTx`, `StockAdjustmentReasonCode`, `StockAdjustmentInput`; removed `quantityOnHand` from `update()`'s type and data object
- `apps/backend/src/controllers/inventoryStock.controller.ts` - Added `adjustInventoryStock`; removed `quantityOnHand` from `updateInventoryStock`'s destructure and data object
- `apps/backend/src/routes/inventoryStock.routes.ts` - Added `POST /:id/adjust` route, gated by `requirePermission("INVENTORY_ADJUST")`
- `apps/backend/prisma/seed.ts` - Added `INVENTORY_ADJUST` permission entry (`SYSTEM_ADMIN`, `WAREHOUSE_DISTRIBUTION_OFFICER`)
- `apps/backend/tests/inventoryStock.adjustment.test.ts` (new) - 5-scenario STOCK-06 coverage using the `createTestUserWithRoles`/`supertest` fixture conventions

## Decisions Made
- `reasonCode` validated as a fixed TypeScript union (`DAMAGE | THEFT | RECOUNT | EXPIRY | CORRECTION | OTHER`) checked against an allow-list in the controller, not a new Prisma enum/column — persisted inside `AuditLog.before` JSON. This follows 03-01-SUMMARY.md's precedent of avoiding new migrations where the audit-log-first pattern already covers the traceability need.

## Deviations from Plan

None — plan executed exactly as written. The route base path is `/api/inventory-stocks` (plural, per the existing mount in `src/routes/index.ts`), which the plan's interface examples implicitly assumed; the test file and this summary use the correct plural path.

### Notes (not deviations, informational)
- Running `npm run db:seed` (per Task 2's verify step) fails partway through — but only in the *business-demo-data reseed block*, which runs *after* `seedRbac()`. This is a pre-existing issue from 03-01 (SalesOrderItem's `lotBatch` → `inventoryStockId` FK migration; `seed.ts`'s sales-order demo rows haven't been updated yet — 03-01-SUMMARY.md already flagged this as expected, deferred to the full seed rewrite in 03-10-PLAN.md). `seedRbac()` itself completed successfully and is idempotent/upsert-based; the `INVENTORY_ADJUST` permission and its two role assignments were verified live in the dev database via direct Prisma queries, independent of the later failure.
- `npx tsc --noEmit` shows 2 pre-existing errors in `src/models/salesOrder.model.ts` (lines 115, 174) — these are the same errors flagged as expected/pending in 03-01-SUMMARY.md ("tsc will still show errors in files not yet updated by later plans"), unrelated to this plan's 3 modified files, which show zero errors.

## Issues Encountered
- Fresh worktree had no `apps/backend/.env` (gitignored) and no `node_modules` — copied `.env` from the main checkout and ran `pnpm install` + `npx prisma generate` before any backend commands would work, same precedent as 03-01-SUMMARY.md.

## User Setup Required

None - no external service configuration required. Same `.env` gitignore caveat as prior phases: any other clone/worktree needs `apps/backend/.env` with `DATABASE_URL`, `PORT`, `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL`, `ALLOWED_ORIGINS` (copied from the main checkout in this session — not part of any commit).

## Next Phase Readiness
- `adjustStockTx` is available for reuse by any future plan needing an audited, guarded stock mutation (e.g. a sales-order-approval stock-deduction path in Phase 4, per STATE.md's flag about revisiting the deduction trigger)
- `INVENTORY_ADJUST` permission is live in the dev database and ready for frontend wiring (not part of this plan's scope)
- `src/models/salesOrder.model.ts`'s pre-existing `lotBatch`/`inventoryStockId` tsc errors remain open for whichever plan in this wave/phase owns that file (03-02, per wave assignment)

---
*Phase: 03-backend-enforcement-lot-batch-stock-control*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: apps/backend/src/models/inventoryStock.model.ts
- FOUND: apps/backend/src/controllers/inventoryStock.controller.ts
- FOUND: apps/backend/src/routes/inventoryStock.routes.ts
- FOUND: apps/backend/prisma/seed.ts
- FOUND: apps/backend/tests/inventoryStock.adjustment.test.ts
- FOUND commit: fa590e9
- FOUND commit: 475afa8
- FOUND commit: 4553149
