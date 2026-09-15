---
phase: 03-backend-enforcement-lot-batch-stock-control
plan: 06
subsystem: frontend
tags: [sales-orders, inventory-stock, forms, typescript, react]

# Dependency graph
requires:
  - phase: 03-backend-enforcement-lot-batch-stock-control
    plan: "04"
    provides: "salesOrder.model.ts/controller.ts now require inventoryStockId and reject lotBatch on sales order item payloads"
provides:
  - "SalesOrderItem.inventoryStockId type (replaces lotBatch)"
  - "SalesOrdersPage.tsx form submits inventoryStockId end-to-end while keeping the same human-readable lot dropdown label"
affects: [03-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ItemRow local form state keeps IDs as strings (matching existing productId/quantity/unitPrice convention), coerced to Number only at submit-payload construction time"

key-files:
  created: []
  modified:
    - apps/frontend/src/api/types.ts
    - apps/frontend/src/pages/SalesOrdersPage.tsx

key-decisions:
  - "Followed the plan's exact action blocks for both files; no deviation needed — plan's line-number/excerpt references matched the live codebase exactly"

requirements-completed: [STOCK-02]

# Metrics
duration: 12min
completed: 2026-09-15
---

# Phase 3 Plan 06: Sales Orders Frontend inventoryStockId Migration Summary

**Sales Orders form (`SalesOrdersPage.tsx`) now submits the numeric `inventoryStockId` FK instead of the free-text `lotBatch` label, completing the D-01/D-07 FK conversion started in 03-04's backend enforcement so order creation/update no longer 400s against the new backend.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-09-15T07:54:00Z
- **Completed:** 2026-09-15T08:06:15Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `apps/frontend/src/api/types.ts`: `SalesOrderItem.lotBatch: string` replaced with `inventoryStockId: number`; the separate `InventoryStock` interface (which legitimately keeps both its own `inventoryStockId: number` and display `lotBatch: string`) left untouched
- `apps/frontend/src/pages/SalesOrdersPage.tsx`: `ItemRow.lotBatch` renamed to `inventoryStockId` (kept as string in local form state per existing convention, coerced with `Number(...)` at submit time); `emptyItem`, both create/update payload-construction sites, the product-change reset handler, the lot `<select>` value/onChange, and the "all required fields present" validation check all updated to reference `inventoryStockId`; the visible lot option label (`{l.lotBatch} ({l.quantityOnHand} · {l.warehouse})`) is unchanged — users still see the same readable lot info, only the underlying submitted value changed from the label string to the lot's numeric id

## Task Commits

Each task was committed atomically:

1. **Task 1: Update SalesOrderItem type — inventoryStockId replaces lotBatch** - `eb100c7` (feat)
2. **Task 2: Update SalesOrdersPage.tsx — submit inventoryStockId, keep lot dropdown display unchanged** - `af80722` (feat)

## Files Created/Modified

- `apps/frontend/src/api/types.ts` - `SalesOrderItem.inventoryStockId: number` replaces `lotBatch: string`
- `apps/frontend/src/pages/SalesOrdersPage.tsx` - `ItemRow.inventoryStockId`, `emptyItem`, both payload sites, product-change reset, lot `<select>` value/onChange, and required-fields validation all migrated from `lotBatch` to `inventoryStockId`

## Decisions Made

No deviation from the plan's `<action>` blocks for either file — implemented exactly as specified. The plan's "current file" excerpts (line numbers, surrounding code) matched the live codebase exactly on read, so both tasks were mechanical renames plus one payload-construction site the plan called out (the edit-modal `openModal`/pre-fill site at what was line 178) that mirrors the submit-payload site at line 218 — both updated identically per the plan's stated payload-construction sites.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Worktree had no `node_modules` (ran `pnpm install` — monorepo-wide, 375 packages, 20s) before `npx tsc --noEmit` could run; no other setup needed since this is a frontend-only, no-DB plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `apps/frontend/src/pages/SalesOrdersPage.tsx` and `apps/frontend/src/api/types.ts` are now fully aligned with 03-04's backend `inventoryStockId` requirement — `npx tsc --noEmit` is clean project-wide, and creating/editing a sales order via the UI will submit a valid payload against the new backend guards
- `03-09-PLAN.md` (wave 5) can build further test coverage on top of this without any frontend-side blocker remaining from the `lotBatch` -> `inventoryStockId` rename

---
*Phase: 03-backend-enforcement-lot-batch-stock-control*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: apps/frontend/src/api/types.ts
- FOUND: apps/frontend/src/pages/SalesOrdersPage.tsx
- FOUND commit: eb100c7
- FOUND commit: af80722
