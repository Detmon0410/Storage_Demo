---
phase: 07-company-profile-permit-deadlines
plan: 07
subsystem: frontend
tags: [typescript, react, dashboard]

# Dependency graph
requires:
  - phase: 07-02
    provides: "License API responses with 6-tier server-computed status codes"
  - phase: 07-04
    provides: "dashboard.permit.* i18n keys, statusTone() coverage for all 5 non-NORMAL codes"
provides:
  - "Dashboard Permit Deadlines section with 5 threshold-bucket tiles (PREPARATION/NOTIFY/WARNING/IMPORTANT_WARNING/EXPIRED)"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plain tone-tinted Link tiles (not AlertCard/StatCard) for on-grid bucket display, per 07-PATTERNS.md"

key-files:
  created: []
  modified:
    - apps/frontend/src/pages/DashboardPage.tsx

key-decisions:
  - "Removed the now-unused FileCheck2 lucide-react import along with the old single Licenses AlertCard tile it powered"

requirements-completed: [PERMIT-03]

# Metrics
duration: 15min
completed: 2026-09-14
---

# Phase 07 Plan 07: Dashboard Permit Deadlines Section Summary

**Replaced the Dashboard's single flat "Licenses expiring/expired" alert tile with a 5-tile "Permit Deadlines" section grouped by the PERMIT-02 threshold tiers, giving a schedule-shaped view instead of one undifferentiated count.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 1 of 2 completed (Task 2 is a blocking human-verify checkpoint)
- **Files modified:** 1

## Accomplishments

- Removed the `expiringLicenses` `useMemo` and the old `AlertCard` instance rendering `title={t("dashboard.alert.licensesTitle")}`
- Added a `permitBuckets` `useMemo` that groups the already-fetched `licenses` list into 5 threshold-tier counts (`PREPARATION`/`NOTIFY`/`WARNING`/`IMPORTANT_WARNING`/`EXPIRED`)
- Added a new "Permit Deadlines" `Card` section, placed above the "Alerts requiring action" heading, containing 5 tone-tinted tiles in a `grid grid-cols-2 sm:grid-cols-5 gap-4` layout, each linking to `/licenses`, ordered calm-to-alarming (Preparation -> Notify -> Warning -> Important Warning -> Expired)
- Removed the now-unused `FileCheck2` import from `lucide-react`
- `cd apps/frontend && npx tsc --noEmit` passes with zero errors

## Task Commits

1. **Task 1: Permit Deadlines 5-bucket dashboard section** - `5bfffc6` (feat)

## Files Created/Modified

- `apps/frontend/src/pages/DashboardPage.tsx` - Replaced flat single-tile Licenses alert with 5-bucket Permit Deadlines section; removed `expiringLicenses` useMemo and unused `FileCheck2` import; added `permitBuckets` useMemo and new tile-grid Card section

## Decisions Made

- Reused existing `statusTone()` (from `apps/frontend/src/lib/status.ts`, extended in Plan 07-04) for tile background tone mapping instead of hardcoding a second tone table in this file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed workspace dependencies**
- **Found during:** Task 1, before running `npx tsc --noEmit`
- **Issue:** This worktree had no `node_modules` installed, blocking the required verification command
- **Fix:** Ran `pnpm install --frozen-lockfile` at the repo root
- **Files modified:** none tracked (node_modules is gitignored)
- **Verification:** `npx tsc --noEmit` ran successfully with zero errors after installation

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Environment setup only; no scope creep.

## Issues Encountered

None beyond the dependency-installation blocker documented above.

## User Setup Required

None - no external service configuration required.

## CHECKPOINT: Human Verification Required

**Task 2** of this plan is a `checkpoint:human-verify` gate and has NOT been completed by this agent — it requires visual/interactive confirmation in a browser, which this agent cannot perform.

**What was built:** Dashboard "Permit Deadlines" section: 5 threshold-bucket tiles (Preparation/Notify/Warning/Important Warning/Expired), each linking to the Licenses page, ordered calm-to-alarming left to right, replacing the old single "Licenses expiring/expired" alert tile.

**How to verify:**
1. Navigate to `/` (Dashboard).
2. Confirm the old single "Licenses expiring / expired" alert tile is gone, replaced by a "Permit Deadlines" section with 5 tiles.
3. Confirm the counts match what you'd expect from the Licenses page (cross-check a couple of licenses' expiry dates against which bucket they land in).
4. Click a bucket tile — confirm it navigates to `/licenses`.
5. Confirm the "Expired" tile is visually the most alarming (rose/red background) and tiles read left-to-right from calm to alarming.

**Resume signal:** Type "approved" or describe issues.

## Next Phase Readiness

- Code task complete and committed; only the human-verify checkpoint remains before this plan can be marked fully done.
- No blockers for sibling parallel plans (07-05, 07-06, 07-08) — this plan only touches `DashboardPage.tsx`.

---
*Phase: 07-company-profile-permit-deadlines*
*Completed: 2026-09-14 (Task 1 only; Task 2 checkpoint pending)*

## Self-Check: PASSED

Verified `apps/frontend/src/pages/DashboardPage.tsx` contains `permitBuckets` useMemo, no longer contains `expiringLicenses` or the old `AlertCard` with `title={t("dashboard.alert.licensesTitle")}`, and renders `t("dashboard.permit.heading")` plus `t(\`dashboard.permit.bucket.${code}\`)` for all 5 tiles. Commit `5bfffc6` confirmed present via `git log --oneline`. `npx tsc --noEmit` passes with zero errors.
