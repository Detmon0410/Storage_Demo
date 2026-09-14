---
phase: 07-company-profile-permit-deadlines
plan: 05
subsystem: frontend
tags: [react, typescript, i18n, routing]

# Dependency graph
requires:
  - phase: 07-04
    provides: "Company TypeScript interface, companyApi client (get/save), company.* i18n keys"
provides:
  - "CompanyPage.tsx — singleton settings-style form for the Company profile (legal name, Tax ID, address)"
  - "/company route registered in App.tsx, Company nav entry in the Compliance nav group"
affects: ["07-06"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Singleton settings-page pattern: local useState + GET-on-mount/PUT-to-save, bypassing the useResource hook (which assumes list/create/update(id)/remove(id))"

key-files:
  created:
    - apps/frontend/src/pages/CompanyPage.tsx
  modified:
    - apps/frontend/src/components/layout/nav.ts
    - apps/frontend/src/App.tsx
    - apps/frontend/src/i18n/locales/en.ts
    - apps/frontend/src/i18n/locales/ja.ts

key-decisions:
  - "Did not use useResource hook for CompanyPage since Company is a GET-one/PUT-one singleton API (no list/create/delete) — used local component state instead, per plan's explicit instruction"
  - "No delete or add-affordance anywhere in CompanyPage.tsx — matches backend singleton enforcement (Plan 07-01) and UI-SPEC contract; the frontend omission is UX convenience only, not the security boundary (accepted threat T-07-10)"

requirements-completed: [COMPANY-01]

# Metrics
duration: 15min
completed: 2026-09-14
---

# Phase 07 Plan 05: Company Profile Settings Page Summary

**Built the Company Profile page as a singleton settings form (GET-on-mount, PUT-to-save) with no create/delete affordances, and registered it in the Compliance nav group and app routing.**

## Performance

- **Duration:** ~15 min
- **Tasks:** 2 completed (code); 1 checkpoint pending human verification
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- Created `apps/frontend/src/pages/CompanyPage.tsx`: a `PageHeader` + single `Card` + `FormGrid` form with `Field`/`TextInput` for Legal Name, Tax ID, Address, and exactly one `Button variant="primary"` ("Save Company Profile") right-aligned at the bottom
- Wired `companyApi.get()` on mount (via `useEffect`) and `companyApi.save(form)` on submit, with `LoadingState`/`ErrorState` (with retry) for the load lifecycle and toast success/error feedback for save
- Client-side required-field guard on Legal Name/Tax ID/Address before calling save, matching the "clear error, not silent failure" truth from the plan's must_haves
- Empty-state helper copy (`company.emptyTitle`/`company.emptyBody`) shown above the form when no profile has been saved yet, without blocking editing
- Registered `/company` route in `App.tsx` (inside the authenticated `AppShell` route group) and a `Company` nav item (Building2 icon) in the existing `nav.group.compliance` group, placed before Licenses
- Added the missing `nav.item.company` i18n key to both `en.ts` ("Company") and `ja.ts` ("会社情報") — Plan 07-04's summary did not add this key, so it was added here per the plan's fallback instruction ("if Plan 07-04 did not already add this key, add it now")

## Task Commits

Each task was committed atomically:

1. **Task 1: CompanyPage.tsx — singleton settings form** - `eb77673` (feat)
2. **Task 2: Register /company route and nav entry** - `830abaf` (feat)

## Files Created/Modified

- `apps/frontend/src/pages/CompanyPage.tsx` - New singleton settings page component
- `apps/frontend/src/components/layout/nav.ts` - Added `Building2` import and Company nav item to the Compliance group
- `apps/frontend/src/App.tsx` - Added `CompanyPage` import and `/company` route
- `apps/frontend/src/i18n/locales/en.ts` - Added `nav.item.company: "Company"`
- `apps/frontend/src/i18n/locales/ja.ts` - Added `nav.item.company: "会社情報"`

## Decisions Made

- Followed the plan's explicit instruction to avoid `useResource` for this page (list-shaped hook, incompatible with the GET-one/PUT-one Company API) and use local `useState` + `useEffect` instead.
- No delete/add UI anywhere in `CompanyPage.tsx` — verified via grep (no "delete"/"trash"/"+ add"/"plus" matches) — consistent with the plan's frontend singleton-enforcement intent (backend is the authoritative boundary per Plan 07-01, accepted threat T-07-10).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing `nav.item.company` i18n key**
- **Found during:** Task 2
- **Issue:** Plan 07-04's summary listed all new i18n keys it added, and `nav.item.company` was not among them, despite Plan 07-05 needing it for the nav label
- **Fix:** Added `nav.item.company: "Company"` to `en.ts` and `nav.item.company: "会社情報"` to `ja.ts`, per the plan's own contingency instruction ("if Plan 07-04 did not already add this key, add it now")
- **Files modified:** `apps/frontend/src/i18n/locales/en.ts`, `apps/frontend/src/i18n/locales/ja.ts`
- **Verification:** `npx tsc --noEmit` passes with zero errors, confirming `ja.ts` structural parity with the `TranslationSchema` derived from `en.ts`
- **Committed in:** `830abaf`

**2. [Rule 3 - Blocking] Installed workspace dependencies**
- **Found during:** Before running `npx tsc --noEmit` for Task 1
- **Issue:** This worktree had no `node_modules` installed, blocking the required verification command
- **Fix:** Ran `pnpm install --frozen-lockfile` at the repo root
- **Files modified:** none tracked (node_modules is gitignored/local-only)
- **Verification:** `npx tsc --noEmit` ran successfully with zero errors afterward
- **Committed in:** N/A (no trackable file changes)

---

**Total deviations:** 2 auto-fixed (both blocking)
**Impact on plan:** No scope creep beyond the plan's two code tasks and their explicitly anticipated fallback (i18n key addition).

## Issues Encountered

None beyond the two blocking fixes documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `CompanyPage.tsx`, the `/company` route, and the Company nav entry are all in place for Plan 07-06 (Licenses page Company/Product select fields) to link to.
- Task 3 (checkpoint:human-verify) is the final task in this plan and has NOT been performed — see Checkpoint section below.

---
*Phase: 07-company-profile-permit-deadlines*
*Completed: 2026-09-14 (code tasks only — checkpoint pending)*

## Self-Check: PASSED

Verified `apps/frontend/src/pages/CompanyPage.tsx` exists and contains exactly one `Button variant="primary"` labeled via `t("company.save")`, no delete/add/list JSX. Verified `apps/frontend/src/App.tsx` contains `<Route path="/company" element={<CompanyPage />} />` inside the `AppShell` route group. Verified `apps/frontend/src/components/layout/nav.ts` contains `to: "/company"` in the compliance group. Verified `nav.item.company` key exists in both `en.ts` and `ja.ts`. Both commits (`eb77673`, `830abaf`) confirmed present via `git log --oneline`. `npx tsc --noEmit` passes with zero errors against the final state of all 5 modified/created files.
