---
phase: 07-company-profile-permit-deadlines
plan: 08
subsystem: frontend
tags: [react, typescript, order-validation, permit-enforcement]

# Dependency graph
requires:
  - phase: 07-03
    provides: "Backend-authoritative assertProductsNotBlockedTx transactional gate wired into all 4 sales/import order mutation entry points"
  - phase: 07-04
    provides: "licenseApi (extended License type with productId/status), salesOrder.validation.permitExpired / importOrder.validation.permitExpired i18n copy"
provides:
  - "SalesOrdersPage.tsx validation.blockers extended with expired-permit check"
  - "ImportOrdersPage.tsx net-new validation.blockers UI (previously absent) with expired-permit check"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-authoritative UX convenience layer: client-side blocker check mirrors the backend's authoritative assertProductsNotBlockedTx gate from Plan 07-03, using licenseApi.list() + productId/status matching, purely to surface the block before submit rather than after a failed API call"

key-files:
  created: []
  modified:
    - apps/frontend/src/pages/SalesOrdersPage.tsx
    - apps/frontend/src/pages/ImportOrdersPage.tsx

key-decisions:
  - "ImportOrdersPage's new validation useMemo is scoped strictly to the expired-permit check, per the plan's explicit instruction not to add any stock/sellable-status gating beyond the permit block (that page has no such precedent unlike SalesOrdersPage)"
  - "Blocker row JSX in ImportOrdersPage copies SalesOrdersPage's rose ShieldAlert class structure verbatim (rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700) to satisfy the UI-SPEC's 'ported, not reinvented' requirement"

requirements-completed: [PERMIT-04]

# Metrics
duration: 15min
completed: 2026-09-14
---

# Phase 07 Plan 08: Order-Blocking UI for Expired Permits (Sales + Import Orders) Summary

**Extended SalesOrdersPage's existing validation.blockers array and introduced a net-new validation.blockers UI in ImportOrdersPage, both surfacing a rose ShieldAlert message and disabling Save when a line item's product has an EXPIRED, product-linked License — a non-authoritative UX convenience over Plan 07-03's backend transactional gate.**

## Performance

- **Duration:** ~15 min (code tasks only; checkpoint task pending human verification)
- **Tasks:** 2 of 3 completed (Task 3 is a blocking human-verify checkpoint)
- **Files modified:** 2

## Accomplishments

- `SalesOrdersPage.tsx`: added `licenseApi` import, `const licenses = useList(() => licenseApi.list())`, and a new check inside the existing `quantityByProduct` loop in the `validation` `useMemo` that pushes `t("salesOrder.validation.permitExpired")` when a line item's product has a linked License with `status === "EXPIRED"`. `licenses` added to the `useMemo` dependency array. No changes needed to blocker-row rendering (already generic).
- `ImportOrdersPage.tsx`: added `ShieldAlert` icon import and `licenseApi` import, `const licenses = useList(() => licenseApi.list())`, and a brand-new `validation` `useMemo` (this page previously had zero blockers/warnings infrastructure) that checks all line-item product IDs against `licenses` for an EXPIRED match. Wired into `handleSubmit` (early-return with `toast.error` when blocked), the Save button (`disabled={validation.blockers.length > 0}`), and new JSX rendering blocker rows with the exact `rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700` + `ShieldAlert` structure copied verbatim from `SalesOrdersPage.tsx`.
- `cd apps/frontend && npx tsc --noEmit` passes with zero errors after both tasks.

## Task Commits

Each task was committed atomically:

1. **Task 1: SalesOrdersPage.tsx — extend validation.blockers with expired-permit check** - `2cb26d0` (feat)
2. **Task 2: ImportOrdersPage.tsx — introduce validation.blockers with expired-permit check** - `2cfc85b` (feat)

Task 3 (checkpoint:human-verify) has not been executed — this plan is paused at that checkpoint per the plan's design (no automated check for visual/interactive UI confirmation).

## Files Created/Modified

- `apps/frontend/src/pages/SalesOrdersPage.tsx` - Added `licenseApi` import and `licenses` list; extended the existing `validation` `useMemo`'s per-line-item loop with an EXPIRED-license check pushing `salesOrder.validation.permitExpired` to `blockers`; added `licenses` to the dependency array
- `apps/frontend/src/pages/ImportOrdersPage.tsx` - Added `ShieldAlert` and `licenseApi` imports and `licenses` list; introduced a new `validation` `useMemo` (`{ blockers: string[] }`) scoped to the expired-permit check only; wired an early-return blocker check with `toast.error` into `handleSubmit`; disabled the Save button when blocked; rendered rose `ShieldAlert` blocker rows in the modal, matching `SalesOrdersPage.tsx`'s pattern verbatim

## Decisions Made

- Kept `ImportOrdersPage`'s new validation logic scoped exclusively to the expired-permit check, per the plan's explicit instruction — no stock/sellable-status gating was added even though `SalesOrdersPage` has such checks, since `ImportOrdersPage` has no existing precedent for those and the plan scoped this task narrowly.
- Copied the blocker-row JSX class structure verbatim from `SalesOrdersPage.tsx` rather than re-deriving it, to guarantee pixel-identical visual consistency between the two order forms per the UI-SPEC's explicit "ported, not reinvented" instruction.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed workspace dependencies**
- **Found during:** Pre-Task-1 verification attempt
- **Issue:** This worktree had no `node_modules` installed anywhere in the workspace, causing `npx tsc` to resolve to an unrelated global `tsc` shim ("This is not the tsc command you are looking for") instead of the project's TypeScript compiler, blocking the required `npx tsc --noEmit` verification command entirely
- **Fix:** Ran `pnpm install --frozen-lockfile` at the repo root
- **Files modified:** none tracked (node_modules is gitignored/local-only)
- **Verification:** `npx tsc --noEmit` ran successfully with zero errors after installation, for both Task 1 and Task 2
- **Committed in:** N/A (no trackable file changes — local environment setup only)

---

**Total deviations:** 1 auto-fixed (blocking, environment setup only)
**Impact on plan:** None — no scope creep or code changes beyond the plan's two code tasks.

## Issues Encountered

None beyond the dependency-installation blocker documented above.

## User Setup Required

None - no external service configuration required for the code tasks. The checkpoint task (Task 3) requires manual browser-based verification — see below.

## Next Phase Readiness

- Both order-entry UIs now show a consistent rose blocker for expired-permit-linked products and block Save, backed by the authoritative Plan 07-03 backend gate.
- This plan is now paused at the `checkpoint:human-verify` gate (Task 3) — see the CHECKPOINT REACHED section returned to the orchestrator for exact manual verification steps.
- No blockers for any other Wave 4 plan; this plan does not affect any downstream phase or plan.

---
*Phase: 07-company-profile-permit-deadlines*
*Completed (code tasks): 2026-09-14*

## Self-Check: PASSED

Verified `apps/frontend/src/pages/SalesOrdersPage.tsx` and `apps/frontend/src/pages/ImportOrdersPage.tsx` on disk contain the `licenseApi`/`ShieldAlert` imports, `licenses` list, and `validation.blockers` permit-expired checks described above. Both commits (`2cb26d0`, `2cfc85b`) confirmed present via `git log --oneline`. `npx tsc --noEmit` passes with zero errors against the final state of both modified files.
