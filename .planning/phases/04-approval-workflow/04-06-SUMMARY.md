---
phase: 04-approval-workflow
plan: 06
subsystem: ui
tags: [react, typescript, i18n, approval-workflow]

# Dependency graph
requires:
  - phase: 04-approval-workflow
    plan: 03
    provides: "salesOrder.controller.ts / importOrder.controller.ts enforcing the real 5-value OrderStatus machine and persisting approvedById/approvedAt/rejectionReason as real columns; ImportOrder.logisticsStatus replacing the overloaded status field"
provides:
  - "apps/frontend/src/api/types.ts: OrderStatus union type, SalesOrder/ImportOrder interfaces matching the Phase 4 backend field split (approvedById/approvedAt/rejectionReason, ImportOrder.logisticsStatus)"
  - "apps/frontend/src/lib/status.ts: tone mapping for DRAFT/REJECTED/CANCELLED approval states"
  - "apps/frontend/src/pages/SalesOrdersPage.tsx and ImportOrdersPage.tsx: free-text approver input removed, Import Orders page operates on logisticsStatus, both tables display real approval status + rejection reason"
  - "apps/frontend/src/i18n/locales/{en,ja}.ts: status.orderApproval.*, importOrder.field.logisticsStatus, importOrder.col.approvalStatus, salesOrder.col.approvalStatus keys"
affects: [frontend-approval-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only approval-status column (Badge + conditional rejection-reason caption) duplicated identically on both SalesOrdersPage and ImportOrdersPage tables, driven by the shared statusTone() helper and status.orderApproval.* i18n namespace"

key-files:
  created: []
  modified:
    - apps/frontend/src/api/types.ts
    - apps/frontend/src/lib/status.ts
    - apps/frontend/src/pages/SalesOrdersPage.tsx
    - apps/frontend/src/pages/ImportOrdersPage.tsx
    - apps/frontend/src/i18n/locales/en.ts
    - apps/frontend/src/i18n/locales/ja.ts

key-decisions:
  - "Followed the plan's exact action blocks verbatim for all four tasks — no functional deviation from the specified field renames, removed-field list, or new column/i18n-key shapes."

requirements-completed: [APPROVAL-01, APPROVAL-04]

# Metrics
duration: ~25min
completed: 2026-09-16
---

# Phase 4 Plan 6: Order Pages Field-Split Sync Summary

**Removed the free-text approver inputs from both order forms, renamed ImportOrdersPage's status field/filter to logisticsStatus, and added a shared read-only approval-status column (with rejection reason) to both order tables — bringing the frontend back in sync with the Phase 4 backend field split.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-16T02:58:00Z
- **Completed:** 2026-09-16T03:25:00Z
- **Tasks:** 4
- **Files modified:** 6

## Accomplishments

- `api/types.ts`: added the `OrderStatus` union type; `ImportOrder` now has `logisticsStatus: string` (renamed from the overloaded `status`) plus real `status: OrderStatus`/`approvedById`/`approvedAt`/`rejectionReason` fields; `SalesOrder` replaced its free-text `approver: string | null` with the same four real fields.
- `lib/status.ts`: added `DRAFT`/`REJECTED`/`CANCELLED` tone entries so the shared `statusTone()` helper covers all 5 `OrderStatus` values without duplicating the pre-existing `APPROVED`/`PENDING_APPROVAL` entries.
- `SalesOrdersPage.tsx`: removed `form.approver` from `FormState`/`emptyForm`/`openEdit`/submit payload/the create-edit form's `Field` block; `validation.needsApproval` is now hardcoded to `false` (backend auto-routes to `PENDING_APPROVAL` regardless of client input per D-04/D-05) while blocker/warning display logic is unchanged; added a new `approvalStatus` table column showing a `Badge` for `r.status` plus the `rejectionReason` caption when `status === "REJECTED"`.
- `ImportOrdersPage.tsx`: renamed `form.status`/`STATUS_OPTIONS` to `form.logisticsStatus`/`LOGISTICS_STATUS_OPTIONS` (narrowed to the 4 real logistics codes: `STAGING`/`CUSTOMS_CLEARED`/`RECEIVED`/`ISSUE`, dropping the stale `PENDING_APPROVAL`/`APPROVED` values that never belonged in the logistics pipeline) across the status filter, form select, table column, and row-highlight logic; removed `form.approver` entirely; replaced the table's `approver` column with the same `approvalStatus` column pattern used on `SalesOrdersPage`.
- `i18n/locales/en.ts` and `ja.ts`: added `status.orderApproval.{DRAFT,PENDING_APPROVAL,APPROVED,REJECTED,CANCELLED}`, `importOrder.col.approvalStatus`, `importOrder.field.logisticsStatus` (replacing `field.status`), `salesOrder.col.approvalStatus`; removed the now-dead `importOrder.field.approver`/`approverHelp` and `salesOrder.field.approver`/`approverHelp` keys from both locale files.
- Verified zero remaining `approver` references anywhere under `apps/frontend/src/` and a clean `npx tsc --noEmit` run across the whole frontend workspace (no errors, not just none in the two modified pages).

## Task Commits

Each task was committed atomically:

1. **Task 1: Update api/types.ts for the Phase 4 field split** - `c41295f` (feat)
2. **Task 2: Update lib/status.ts tone mapping for the new approval values** - `ec977dc` (feat)
3. **Task 3: Remove the approver field and fix status usage on both order pages** - `906a2a3` (feat)
4. **Task 4: Add the new i18n keys to en.ts and ja.ts** - `96e4ae8` (feat)

**Plan metadata:** committed separately after this SUMMARY (worktree mode — orchestrator handles final metadata commit)

## Files Created/Modified

- `apps/frontend/src/api/types.ts` - `OrderStatus` union type; `ImportOrder`/`SalesOrder` interfaces match the Phase 4 backend field split
- `apps/frontend/src/lib/status.ts` - Added `DRAFT`/`REJECTED`/`CANCELLED` tone entries
- `apps/frontend/src/pages/SalesOrdersPage.tsx` - Removed approver field/gate; added read-only approval-status + rejection-reason column
- `apps/frontend/src/pages/ImportOrdersPage.tsx` - Renamed status to logisticsStatus throughout; removed approver field/column; added approval-status + rejection-reason column
- `apps/frontend/src/i18n/locales/en.ts` - Added `orderApproval`/`approvalStatus`/`logisticsStatus` keys, removed `approver`/`approverHelp` keys
- `apps/frontend/src/i18n/locales/ja.ts` - Mirrored the same key additions/removals with Japanese translations

## Decisions Made

- Followed the plan's exact action blocks verbatim for all four tasks — no functional deviation from the specified field renames, removed-field list, or new column/i18n-key shapes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing frontend dependencies in worktree**
- **Found during:** Pre-verification for Task 3, before running `npx tsc --noEmit`
- **Issue:** This worktree had no `node_modules` anywhere in the repo (fresh worktree checkout), blocking `npx tsc`.
- **Fix:** Ran `pnpm install` at the worktree root (build scripts for `@prisma/client`/`esbuild`/`prisma` were left ignored — no backend build/generate needed for this frontend-only plan).
- **Files modified:** `node_modules/` (gitignored, not committed)
- **Verification:** `npx tsc --noEmit -p tsconfig.json` ran cleanly afterward with zero errors across the whole frontend workspace.
- **Committed in:** N/A (gitignored; nothing to commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking environment/tooling setup, no schema or business-logic changes)
**Impact on plan:** No scope creep — the environment fix was required to execute the plan's own verification steps in this sandboxed worktree.

## Issues Encountered

None beyond the environment setup documented above.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. Both pages now render the real backend-provided approval status and rejection reason; no placeholder/mock data paths were introduced.

## Threat Flags

None. This plan's own `<threat_model>` (T-04-07, accepted disposition) covers the only trust-boundary-relevant change (displaying `rejectionReason` in the UI) — no new unaddressed surface was introduced.

## Next Phase Readiness

- Both order-management pages now compile against and correctly consume the Phase 4 backend field split (`logisticsStatus`, `status`, `approvedById`, `approvedAt`, `rejectionReason`), closing out APPROVAL-01 and APPROVAL-04 for the frontend surface.
- No free-text approver input remains anywhere in the codebase (verified via a full `apps/frontend/src/` grep).
- No blockers for remaining phase 4 plans or later phases.

---
*Phase: 04-approval-workflow*
*Completed: 2026-09-16*

## Self-Check: PASSED

All claimed files found on disk (apps/frontend/src/api/types.ts, apps/frontend/src/lib/status.ts, apps/frontend/src/pages/SalesOrdersPage.tsx, apps/frontend/src/pages/ImportOrdersPage.tsx, apps/frontend/src/i18n/locales/en.ts, apps/frontend/src/i18n/locales/ja.ts). All claimed commits found in git log (c41295f, ec977dc, 906a2a3, 96e4ae8).
