---
phase: 07-company-profile-permit-deadlines
plan: 01
subsystem: database
tags: [prisma, mysql, express, vitest, tdd]

# Dependency graph
requires: []
provides:
  - "Company singleton Prisma model + live-DB migration"
  - "License.companyId/productId nullable FKs (License.daysRemaining/status columns dropped)"
  - "computePermitStatus(expiryDate, today?) pure function with 6-tier boundary classification"
  - "GET/PUT /api/companies singleton backend (model/controller/routes), requireAuth-gated"
  - "Seeded default Company row (companyId: 1)"
affects: [07-02, 07-03, 07-04, 07-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Singleton resource pattern: model exposes only find/upsert pinned to a fixed ID; routes expose only GET/PUT '/' with no :id or list-create route"
    - "Status/daysRemaining computed-on-read via pure function rather than stored columns"

key-files:
  created:
    - apps/backend/src/utils/permitStatus.ts
    - apps/backend/src/models/company.model.ts
    - apps/backend/src/controllers/company.controller.ts
    - apps/backend/src/routes/company.routes.ts
    - apps/backend/tests/permitStatus.test.ts
    - apps/backend/tests/company.test.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/src/routes/index.ts
    - apps/backend/prisma/seed.ts

key-decisions:
  - "License-creation loop in seed.ts intentionally left referencing daysRemaining/status per plan instruction (Plan 07-02's responsibility) — Company row is created before this loop runs, so the Company seed goal is met even though the license loop itself will need Plan 07-02's update to run cleanly against the new schema"

patterns-established:
  - "Pure computed-status pattern: computePermitStatus(expiryDate, today?) — no DB dependency, exported for reuse by License model (07-02) and order-blocking gate (07-03)"

requirements-completed: [COMPANY-01, PERMIT-01, PERMIT-02]

# Metrics
duration: 35min
completed: 2026-09-14
---

# Phase 07 Plan 01: Schema Foundation & Company Profile Backend Summary

**Company singleton model, License FK rework (companyId/productId, dropped daysRemaining/status), computePermitStatus 6-tier pure function, and full Company CRUD backend, all pushed live and test-covered.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-14T09:00:00Z
- **Completed:** 2026-09-14T09:05:30Z (est.)
- **Tasks:** 3 completed
- **Files modified:** 9

## Accomplishments
- Added `Company` model to `schema.prisma`, added nullable `companyId`/`productId` FKs to `License`, dropped hand-set `daysRemaining`/`status` columns, and pushed the change to the live MySQL database via `prisma db push --accept-data-loss`
- Implemented `computePermitStatus` as a pure Date-arithmetic function classifying expiry into NORMAL/PREPARATION/NOTIFY/WARNING/IMPORTANT_WARNING/EXPIRED across all boundary cases (120/90/60/30/0-day tiers), following full TDD (RED test commit before GREEN implementation commit)
- Built the Company singleton backend end-to-end: model (`find`/`upsert` only, pinned to `companyId: 1`), controller with required-field validation, routes (`GET /`, `PUT /` only, both `requireAuth`-gated, no list/create/delete), registered at `/api/companies`
- Seeded a default Company row (Tokyo Liquor Import Co., Ltd.) and added `company.deleteMany()` to the seed reset transaction (positioned after `license.deleteMany()` to respect the FK)
- Full backend test suite (48 tests across 10 files, including the 2 new test files) passes

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema — Company model, License FKs, drop daysRemaining/status, push to DB** - `af1eca4` (feat)
2. **Task 2: computePermitStatus pure function + unit tests** - `b4b07d2` (test, RED) → `c9942b0` (feat, GREEN)
3. **Task 3: Company singleton backend + seed default Company** - `da26c07` (feat)

**Plan metadata:** (this commit, docs: complete plan)

_Note: Task 2 was TDD — test committed first and confirmed failing (module not found), then implementation committed and confirmed all 10 tests passing._

## Files Created/Modified
- `apps/backend/prisma/schema.prisma` - Added `Company` model, `License.companyId`/`productId` FKs + relations, `Product.licenses` back-relation, dropped `License.daysRemaining`/`status`
- `apps/backend/src/utils/permitStatus.ts` - `computePermitStatus(expiryDate, today?)` pure function, exports `PermitBucket`
- `apps/backend/tests/permitStatus.test.ts` - 10 boundary-case unit tests (150/120/121/90/60/30/31/0/-1 days + time-of-day normalization)
- `apps/backend/src/models/company.model.ts` - `CompanyModel.find`/`upsert`, singleton pinned to `companyId: 1`
- `apps/backend/src/controllers/company.controller.ts` - `getCompany`/`saveCompany` with required-field 400 validation
- `apps/backend/src/routes/company.routes.ts` - `GET /`, `PUT /`, both `requireAuth`
- `apps/backend/src/routes/index.ts` - Registered `apiRoutes.use("/companies", companyRoutes)`
- `apps/backend/prisma/seed.ts` - Added `company.deleteMany()` to reset transaction; creates default Company row before license loop
- `apps/backend/tests/company.test.ts` - 5 tests: auth enforcement (401s), 400 on missing fields, PUT-then-GET round trip, upsert-not-duplicate verification

## Decisions Made
- Left the seed.ts license-creation loop (lines referencing `daysRemaining`/`status`) untouched per explicit plan instruction — this is Plan 07-02's responsibility since it owns the License model rework. The Company row is created before this loop in the seed script, so `db:setup` still produces exactly one Company row even though the license loop itself will need Plan 07-02's schema-aligned rewrite to complete without a Prisma validation error on unknown fields. This is a known, plan-acknowledged intermediate state.
- Restored missing `apps/backend/.env` in this worktree (copied from the main repo checkout, gitignored, not committed) — required to run `prisma db push`, `prisma validate`, and the test suite against the local MySQL instance. This is local dev environment setup, not a code change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed workspace dependencies and restored local .env**
- **Found during:** Task 1 (schema push)
- **Issue:** This worktree had no `node_modules` installed and no `apps/backend/.env`, blocking `npx prisma validate`/`db push` and the test suite entirely
- **Fix:** Ran `pnpm install --frozen-lockfile` at the repo root; copied `apps/backend/.env` from the main repo checkout (gitignored, untracked, not part of any commit)
- **Files modified:** none tracked (node_modules and .env are both gitignored/local-only)
- **Verification:** `npx prisma -v` resolved to workspace-local Prisma 6.19.3; `npx prisma validate` and `npx prisma db push --accept-data-loss` both succeeded
- **Committed in:** N/A (no trackable file changes — local environment setup only)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Environment setup only; no scope creep or code changes beyond the plan's tasks.

## Issues Encountered
- `npx prisma` initially resolved to a globally-cached Prisma 7.10.0 (incompatible schema syntax) before `pnpm install` populated the workspace's local Prisma 6.19.3 — resolved by installing dependencies first.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `computePermitStatus` is ready for Plan 07-02 (License model) and Plan 07-03 (order-blocking gate) to import directly
- `Company` schema and backend are ready for Plan 07-05 (frontend Company profile UI) to consume via `GET`/`PUT /api/companies`
- Plan 07-02 must rewrite the seed.ts license-creation loop and the License model/controller to use the new `companyId`/`productId` FKs and drop references to `daysRemaining`/`status` — this is a known, expected follow-up, not a new blocker

---
*Phase: 07-company-profile-permit-deadlines*
*Completed: 2026-09-14*

## Self-Check: PASSED

All created files confirmed present on disk (permitStatus.ts, company.model.ts, company.controller.ts, company.routes.ts, permitStatus.test.ts, company.test.ts). All 4 task commits (af1eca4, b4b07d2, c9942b0, da26c07) confirmed present in `git log`.
