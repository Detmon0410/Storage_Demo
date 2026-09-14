---
phase: 07-company-profile-permit-deadlines
plan: 04
subsystem: frontend
tags: [typescript, react, i18n, api-client]

# Dependency graph
requires:
  - phase: 07-01
    provides: "Company backend (GET/PUT /api/companies), computePermitStatus 6-tier classification"
  - phase: 07-02
    provides: "License API responses including companyId/productId/company/product, server-computed status/daysRemaining"
provides:
  - "Company TypeScript interface + companyApi client (get/save) for frontend pages"
  - "Extended License interface with companyId/productId/company/product fields"
  - "TONE_BY_CODE entries for all 6 permit tier status codes (NORMAL/PREPARATION/NOTIFY/WARNING/IMPORTANT_WARNING/EXPIRED)"
  - "Full i18n copy (en + ja) for company.*, 6-tier status.license, license.field company/product selects, dashboard.permit buckets, salesOrder/importOrder validation.permitExpired"
affects: ["07-05", "07-06", "07-07", "07-08"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Singleton API client pattern: companyApi = { get, save } (no createResourceApi<T>, since Company has no list/create/delete)"

key-files:
  created: []
  modified:
    - apps/frontend/src/api/types.ts
    - apps/frontend/src/api/resources.ts
    - apps/frontend/src/lib/status.ts
    - apps/frontend/src/i18n/locales/en.ts
    - apps/frontend/src/i18n/locales/ja.ts

key-decisions:
  - "Used exact English copy strings verbatim from 07-UI-SPEC.md's Copywriting Contract (no paraphrasing) for company.*, permit tier labels, dashboard bucket labels, and the order-blocking message, so downstream plans and the UI checker match precisely"
  - "Wrote idiomatic (not literal) Japanese translations for all new keys, following the existing tone of license/customerLicense/supplier sections already in ja.ts"

requirements-completed: [COMPANY-01, PERMIT-01, PERMIT-02, PERMIT-03, PERMIT-04]

# Metrics
duration: 20min
completed: 2026-09-14
---

# Phase 07 Plan 04: Frontend Interface Contracts & i18n Foundation Summary

**Established the `Company` type/API client, extended `License` type, permit-tier Badge tone mappings, and every new en/ja translation key that Plans 07-05 through 07-08 depend on — interface-first ordering to avoid file-ownership conflicts across parallel Wave 4 plans.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed
- **Files modified:** 5

## Accomplishments

- Added a `Company` interface (`companyId`/`legalName`/`taxId`/`address`) to `apps/frontend/src/api/types.ts`, placed near `Supplier`
- Extended the `License` interface with `companyId: number | null`, `productId: number | null`, `company?: Company`, `product?: Product`
- Added `companyApi` to `apps/frontend/src/api/resources.ts` as a hand-written singleton client (`get`/`save`, not `createResourceApi<Company>`), matching the backend's singleton-resource pattern from Plan 07-01
- Extended `TONE_BY_CODE` in `apps/frontend/src/lib/status.ts` with `PREPARATION: "neutral"`, `NOTIFY: "info"`, `WARNING: "warning"`, `IMPORTANT_WARNING: "warning"`, keeping `NORMAL: "success"`/`EXPIRED: "danger"` and removing the now-unused `EXPIRING_SOON` entry (backend no longer emits this code per Plan 07-02's 5-to-6-tier rework)
- Added the full `company.*` i18n block (title/subtitle/save/emptyTitle/emptyBody/errorSave/errorLoad/toastSaved/field) to both `en.ts` and `ja.ts`, using the exact English copy from `07-UI-SPEC.md`'s Copywriting Contract
- Replaced `status.license`'s 3-key set with the 6-tier set (`NORMAL`/`PREPARATION`/`NOTIFY`/`WARNING`/`IMPORTANT_WARNING`/`EXPIRED`) in both locales
- Added `license.field.company`/`product`/`productPlaceholder` for the upcoming License form Company/Product selects
- Added `dashboard.permit.heading`/`bucket.{PREPARATION,NOTIFY,WARNING,IMPORTANT_WARNING,EXPIRED}` for the dashboard's new permit-deadline bucket tiles
- Added `salesOrder.validation.permitExpired` and a new `importOrder.validation.permitExpired` (the latter required creating a new `validation` sub-key in `importOrder`, which previously had none) — both using the exact order-blocking copy from the UI spec
- `cd apps/frontend && npx tsc --noEmit` passes with zero errors after each task, confirming type compilation and `ja.ts`'s structural parity with the `TranslationSchema` type derived from `en.ts`

## Task Commits

Each task was committed atomically:

1. **Task 1: Company/License types, companyApi, permit-tier Badge tones** - `3a72bc7` (feat)
2. **Task 2: i18n — company.*, permit tier labels, dashboard bucket copy, order-block message (en + ja)** - `90d098d` (feat)

## Files Created/Modified

- `apps/frontend/src/api/types.ts` - Added `Company` interface; extended `License` with `companyId`/`productId`/`company`/`product`
- `apps/frontend/src/api/resources.ts` - Added `companyApi` singleton client (`get`/`save`); added `Company` to the `import type` block
- `apps/frontend/src/lib/status.ts` - `TONE_BY_CODE`'s `// license.status` section extended to 6 permit tier codes; `EXPIRING_SOON` removed
- `apps/frontend/src/i18n/locales/en.ts` - Added `company` top-level key; replaced `status.license` 3-tier set with 6-tier set; added `license.field.company/product/productPlaceholder`; added `dashboard.permit`; added `salesOrder.validation.permitExpired`; added new `importOrder.validation.permitExpired`
- `apps/frontend/src/i18n/locales/ja.ts` - Mirror of all `en.ts` additions above, with idiomatic Japanese copy matching existing file tone

## Decisions Made

- English copy strings for all new keys use the exact wording from `07-UI-SPEC.md`'s Copywriting Contract verbatim (no paraphrasing), so the upcoming UI-checker pass and downstream plans match precisely.
- Japanese translations are idiomatic rather than literal, following the established tone of `license`/`customerLicense`/`supplier` sections already present in `ja.ts`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed workspace dependencies**
- **Found during:** Task 1, before running `npx tsc --noEmit`
- **Issue:** This worktree had no `node_modules` installed anywhere in the workspace, blocking the required `tsc --noEmit` verification command entirely
- **Fix:** Ran `pnpm install --frozen-lockfile` at the repo root
- **Files modified:** none tracked (node_modules is gitignored/local-only)
- **Verification:** `npx tsc --noEmit` ran successfully and passed with zero errors after installation
- **Committed in:** N/A (no trackable file changes — local environment setup only)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Environment setup only; no scope creep or code changes beyond the plan's two tasks.

## Issues Encountered

None beyond the dependency-installation blocker documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `Company` type and `companyApi` are ready for Plan 07-05 (Company Profile page) to consume directly via `companyApi.get()`/`companyApi.save()`
- Extended `License` type (`companyId`/`productId`/`company`/`product`) and the 6-tier `TONE_BY_CODE` map are ready for Plan 07-06 (Licenses page — Company/Product select fields, permit tier Badge)
- `dashboard.permit` copy and the 5-tier tone mapping are ready for Plan 07-07 (Dashboard permit deadline bucket tiles)
- `salesOrder.validation.permitExpired` and `importOrder.validation.permitExpired` copy are ready for Plan 07-08 (frontend order-blocking UI, consuming the already-live backend gate from Plan 07-03)
- No blockers identified for downstream Wave 4 plans; all four consume only the interfaces/copy established here without needing to touch `types.ts`/`resources.ts`/`status.ts`/the locale files themselves

---
*Phase: 07-company-profile-permit-deadlines*
*Completed: 2026-09-14*

## Self-Check: PASSED

Verified `Company` interface present in `apps/frontend/src/api/types.ts`, `companyApi` present in `apps/frontend/src/api/resources.ts`, and the 4 new permit-tier tone entries present in `apps/frontend/src/lib/status.ts`. Both commits (`3a72bc7`, `90d098d`) confirmed present in `git log --oneline`. `npx tsc --noEmit` passes with zero errors against the final state of all 5 modified files.
