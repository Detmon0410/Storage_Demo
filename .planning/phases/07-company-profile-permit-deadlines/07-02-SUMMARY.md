---
phase: 07-company-profile-permit-deadlines
plan: 02
subsystem: api
tags: [prisma, express, vitest, tdd, license]

# Dependency graph
requires:
  - phase: 07-01
    provides: "Company model, License.companyId/productId FKs, computePermitStatus pure function"
provides:
  - "LicenseModel/LicenseController accepting optional companyId/productId on create/update"
  - "License API responses with status/daysRemaining always server-computed from expiryDate via computePermitStatus"
  - "Seeded IMPORT licenses linked to the seeded Company row"
affects: [07-03, 07-04, 07-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "shape() wrapper pattern: spread Prisma row + computePermitStatus(expiryDate) result, applied on every read/create/update response, never trusting client-supplied status/daysRemaining"

key-files:
  created:
    - apps/backend/tests/license.test.ts
  modified:
    - apps/backend/src/models/license.model.ts
    - apps/backend/src/controllers/license.controller.ts
    - apps/backend/prisma/seed.ts

key-decisions:
  - "Ran npm run db:setup against the shared dev DB (schema was already in sync from Plan 07-01, so 'prisma db push' was a no-op; only the seed step wrote data) — safe under the parallel-executor constraint since no re-push occurred"
  - "Added defensive stray-row cleanup (deleteMany by test-specific prefix) to license.test.ts's beforeAll to keep the Company singleton-count assertion in company.test.ts accurate across repeated/interrupted test runs"

patterns-established:
  - "Computed-on-read status pattern extended from Company (07-01) to License: no status/daysRemaining ever accepted from request body, always derived from expiryDate"

requirements-completed: [PERMIT-01, PERMIT-02]

# Metrics
duration: 25min
completed: 2026-09-14
---

# Phase 07 Plan 02: License companyId/productId + Server-Computed Status Summary

**LicenseModel/Controller now accept optional companyId/productId FKs and compute status/daysRemaining from expiryDate via computePermitStatus on every response, closing the client-trusted-status bug; seeded IMPORT licenses linked to the seeded Company.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-14T09:09:00+07:00 (est.)
- **Completed:** 2026-09-14T09:17:33+07:00
- **Tasks:** 2 completed
- **Files modified:** 4

## Accomplishments
- Rewrote `LicenseModel` to include `company`/`product` Prisma relations and wrap every `findAll`/`findById`/`create`/`update` response through a `shape()` helper that spreads in `computePermitStatus(expiryDate)` — `status`/`daysRemaining` can never be a stored/trusted value again
- Rewrote `LicenseController` so `daysRemaining`/`status` are never destructured from `req.body` in `createLicense`/`updateLicense` — even an attacker who explicitly sends `daysRemaining: -999, status: "NORMAL"` gets back a response computed purely from `expiryDate`
- Added `companyId`/`productId` as optional, nullable-settable fields on create/update, following the existing `optionalNullableId` coercion pattern
- Wrote `apps/backend/tests/license.test.ts` (7 tests) covering every behavior in the plan: unlinked create, linked create with populated relations, fake-status-ignored, future-date NORMAL, past-date EXPIRED, PUT updating only companyId, and unlinked licenses round-tripping through `GET /api/licenses`
- Followed full TDD: RED commit (7/8 tests failing against the pre-change model/controller) before the GREEN commit
- Updated `prisma/seed.ts`'s `licenses` array to 6-element tuples (dropped trailing `daysRemaining`/`status` values matching the already-dropped schema columns) and linked all 6 seeded IMPORT licenses to `company.companyId`
- Verified via `npm run db:setup` (schema already in sync — no re-push — and seed completed cleanly) and full backend suite (55/55 tests passing)

## Task Commits

Each task was committed atomically:

1. **Task 1a: RED — failing License tests** - `4c210b5` (test)
2. **Task 1b: GREEN — LicenseModel/Controller rewrite** - `dbf39eb` (feat)
3. **Task 2: Seed data — link licenses to Company, drop daysRemaining/status** - `5e453ce` (feat)

**Plan metadata:** (this commit, docs: complete plan)

_Note: Task 1 was TDD — test committed first and confirmed failing (7/8 tests failed against the old model requiring daysRemaining/status), then the model/controller rewrite committed and confirmed all 7 tests passing._

## Files Created/Modified
- `apps/backend/src/models/license.model.ts` - `create`/`update` now accept `companyId?`/`productId?`, `findAll`/`findById`/`create`/`update` all route through `shape()` which merges in `computePermitStatus(license.expiryDate)`; `include: { company: true, product: true }` on every query
- `apps/backend/src/controllers/license.controller.ts` - `daysRemaining`/`status` removed entirely from destructuring and required-field validation in both `createLicense` and `updateLicense`; `companyId`/`productId` added via `optionalNullableId`
- `apps/backend/tests/license.test.ts` - 7 integration tests covering companyId/productId linkage, computed status/daysRemaining, attacker-supplied-status rejection, and backward compatibility with unlinked licenses
- `apps/backend/prisma/seed.ts` - `licenses` array rows reduced to 6 elements (issueDate/expiryDate as last fields, no trailing status pair); license-creation loop now passes `companyId: company.companyId` for all 6 seeded rows

## Decisions Made
- Ran `npm run db:setup` against the shared dev database used by the concurrent 07-03 executor. This was judged safe because `prisma db push` reported "already in sync" (no schema mutation occurred — Plan 07-01 already pushed the relevant changes) and only the idempotent `prisma db seed` step ran, which is expected end-state data both plans rely on.
- Added defensive `deleteMany`-by-prefix cleanup to `license.test.ts`'s `beforeAll` (see Deviations) rather than modifying `company.test.ts`'s assertion, since the correct fix is to make the new test file self-cleaning, not to weaken an existing correctness check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored workspace dependencies, `.env`, and regenerated Prisma client**
- **Found during:** Task 1 (before any test could run)
- **Issue:** This worktree had no `node_modules` and no `apps/backend/.env`, and the Prisma client was stale relative to Plan 07-01's schema changes already pushed to the shared dev DB
- **Fix:** Ran `pnpm install --frozen-lockfile` at the repo root; copied `apps/backend/.env` from the main repo checkout (gitignored, untracked); ran `npx prisma generate` to regenerate the client against the current schema (no `db push` performed, per parallel-execution instructions)
- **Files modified:** none tracked (node_modules, .env, and the generated client are all gitignored/local-only)
- **Verification:** `npx prisma generate` succeeded; subsequent test runs correctly typed `Company`/`Product` relations on `License`

**2. [Rule 1 - Bug] Fixed a stray leftover Company row causing `company.test.ts` to fail intermittently**
- **Found during:** Task 1, after the initial GREEN pass — full suite run showed `company.test.ts`'s singleton-count assertion (`expect(count).toBe(1)`) failing with `count === 2`
- **Issue:** An earlier interrupted test run had left a `Company` row (created by `license.test.ts`'s `beforeAll` for the companyId/productId-linkage test) undeleted in the shared dev database, since its `afterAll` cleanup never ran to completion in that prior run. This inflated the company row count for any later run of `company.test.ts`, regardless of order.
- **Fix:** Added defensive `deleteMany`-by-known-prefix cleanup (matching `LIC-TEST-`, `LIC_TEST_PROD_`, `LIC_TEST_CAT_`, `LIC_TEST_SUP_`, `T-LIC-TEST-`) to the top of `license.test.ts`'s `beforeAll`, so any stray rows from a prior interrupted run are removed before the current run creates its own fixtures
- **Files modified:** `apps/backend/tests/license.test.ts`
- **Verification:** Re-ran `npm test` — full suite (55/55) now passes consistently, including `company.test.ts`'s singleton-count assertion
- **Committed in:** `dbf39eb` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes were necessary for correctness and to unblock test execution; no scope creep beyond the plan's two tasks.

## Issues Encountered
- `git status --short` showed CRLF line-ending warnings on commit for all three modified/created TypeScript files (`license.model.ts`, `license.controller.ts`, `license.test.ts`) — this is Git's existing `core.autocrlf` behavior in this Windows checkout, not a content issue; no action needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- License API is fully ready for Plan 07-03 (order-blocking gate) to query `LicenseModel.findAll`/`findById` and rely on `status`/`daysRemaining` always being accurate relative to `expiryDate`
- Seeded IMPORT licenses are linked to the seeded Company (`companyId: 1`), ready for Plan 07-05's frontend Company profile + permit deadlines UI to consume via `GET /api/licenses` with populated `company` relations
- No blockers identified for downstream plans

---
*Phase: 07-company-profile-permit-deadlines*
*Completed: 2026-09-14*

## Self-Check: PASSED

All created/modified files confirmed present on disk (license.test.ts, license.model.ts, license.controller.ts, seed.ts). All 3 task commits (4c210b5, dbf39eb, 5e453ce) confirmed present in `git log`.
