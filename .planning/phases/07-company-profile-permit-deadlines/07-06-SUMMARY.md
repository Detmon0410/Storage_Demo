---
phase: 07-company-profile-permit-deadlines
plan: 06
subsystem: frontend
tags: [typescript, react, forms]

# Dependency graph
requires:
  - phase: 07-02
    provides: "License API accepts companyId/productId, ignores client-sent daysRemaining/status, always returns server-computed status/daysRemaining"
  - phase: 07-04
    provides: "Company type/companyApi client, extended License interface (companyId/productId/company/product), license.field.company/product i18n keys"
provides:
  - "LicensesPage.tsx form with optional Company/Product link selects"
  - "Removal of client-guessed daysRemaining/status manual inputs from the License form"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Singleton-record auto-select: since only one Company exists, its id is pre-filled into the create form once companyApi.get() resolves, using the useEffect + useList data-fetching pattern already established elsewhere in the app"

key-files:
  created: []
  modified:
    - apps/frontend/src/pages/LicensesPage.tsx

key-decisions:
  - "Followed the plan's exact select-field markup and field ordering; no deviations were needed since Plan 07-04 had already delivered every interface (Company type, companyApi, productApi, i18n keys) this plan consumes"

requirements-completed: [PERMIT-01, PERMIT-02]

# Metrics
duration: 15min
completed: 2026-09-14
---

# Phase 07 Plan 06: Licenses Form — Company/Product Links Summary

**Extended the Licenses create/edit form with optional Company and Product select fields and removed the obsolete manual daysRemaining/status inputs, since both are now computed server-side by Plan 07-02.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 1 code task (Task 1) + 1 human-verify checkpoint (Task 2, pending)
- **Files modified:** 1

## Accomplishments

- Added `companyApi`/`productApi` imports and a `Company`/`License` type import to `LicensesPage.tsx`
- Added `useEffect`-driven `companyApi.get()` fetch into local `company` state, and `useList(() => productApi.list())` for the product dropdown options
- Replaced `FormState`'s `daysRemaining: string; status: string;` with `companyId: string; productId: string;`, and updated `emptyForm` to match
- `openCreate` now pre-selects the singleton Company's id into the form (per `07-PATTERNS.md`'s single-Company assumption) whenever the record has already loaded
- Removed `STATUS_OPTIONS`, `computeStatus`, and `handleExpiryChange`'s status-computing side effect entirely; the expiry date `TextInput`'s `onChange` now just sets `expiryDate` with no derived fields
- `openEdit` now populates `companyId`/`productId` from the row's linked ids instead of `daysRemaining`/`status`
- `handleSubmit`'s payload now sends `companyId`/`productId` as `number | null` and no longer sends `daysRemaining`/`status`
- Replaced the two manual `daysRemaining`/`status` form `Field`s with two new `SelectField`s: "Company" (optional, "-- None --" default, single Company option once loaded) and "Product" (optional, "-- Not product-specific --" default, populated from `productApi.list()`)
- Left the table's status Badge and days-left columns, plus the `expiringSoon`/`expired` `useMemo` filters, completely unchanged — they continue to read `r.status`/`r.daysRemaining` from the (now server-computed) API response
- `cd apps/frontend && npx tsc --noEmit` passes with zero errors

## Task Commits

1. **Task 1: LicensesPage.tsx — Company/Product selects, remove manual status inputs** - `8bb0981` (feat)

## Files Created/Modified

- `apps/frontend/src/pages/LicensesPage.tsx` - Added Company/Product `SelectField`s to the create/edit form; removed `STATUS_OPTIONS`, `computeStatus`, `daysRemaining`/`status` form state; payload now sends `companyId`/`productId`

## Decisions Made

- No deviations from the plan's specified markup/field ordering were required — every interface this plan depends on (`Company` type, `companyApi`, `productApi`, i18n keys) was already delivered by Plan 07-04, and the backend contract (ignore client status/daysRemaining, always compute server-side) was already delivered by Plan 07-02.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- This worktree had no `node_modules` installed (same environment-setup issue documented in Plan 07-04's summary, since worktrees are isolated). Ran `pnpm install --frozen-lockfile` at the repo root before running `npx tsc --noEmit`. No trackable file changes resulted (node_modules is gitignored).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Task 1 (the only automatable task) is complete and committed. Task 2 is a `checkpoint:human-verify` gate requiring manual browser interaction (this executor cannot open a browser) — see the CHECKPOINT REACHED report for exact verification steps.

---
*Phase: 07-company-profile-permit-deadlines*
*Completed: 2026-09-14*

## Self-Check: PASSED

Verified `apps/frontend/src/pages/LicensesPage.tsx` no longer contains `STATUS_OPTIONS`, `computeStatus`, or `daysRemaining: string`/`status: string` in `FormState` (grep returned zero matches). Verified `companyId: string;` and `productId: string;` are present in `FormState`. Commit `8bb0981` confirmed present in `git log --oneline`. `npx tsc --noEmit` passes with zero errors against the final state of the modified file. Working tree is clean after the commit (no unexpected deletions, no stray untracked files).
