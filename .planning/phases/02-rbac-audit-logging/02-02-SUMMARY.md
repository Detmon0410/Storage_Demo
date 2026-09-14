---
phase: 02-rbac-audit-logging
plan: 02
subsystem: backend
tags: [express, prisma, rbac, middleware, vitest]

# Dependency graph
requires:
  - phase: 02-rbac-audit-logging
    plan: 01
    provides: Role/Permission/UserRole/RolePermission Prisma models, seeded 6 roles + 45 permission codes
provides:
  - RoleModel.getUserPermissionCodes/getUserRoleCodes reusable DB-derived permission query
  - requirePermission(code) Express middleware enforcement primitive
  - createTestUserWithRoles test fixture helper
  - category.routes.ts as the reference-implementation module for permission enforcement
affects: [all later Phase 02 route-wiring plans that replicate requirePermission across the other 10 route files, plan 02-11 self-lockout guard, plan 02-12 GET /auth/me]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "requirePermission(code) mirrors requireAuth's exact conventions: interface-extension (PermissionRequest extends AuthenticatedRequest), HttpError + next(), .js import extensions"
    - "Per-request memoization via req.permissions ??= ... — not a cross-request cache, satisfies RBAC-06 DB re-derivation requirement"
    - "describe.each/it.each table-driven enforcement tests per route+permission-code pair"

key-files:
  created:
    - apps/backend/src/models/role.model.ts
    - apps/backend/src/middleware/permission.ts
    - apps/backend/tests/rbac.permissionUnion.test.ts
    - apps/backend/tests/rbac.revocation.test.ts
    - apps/backend/tests/rbac.enforcement.test.ts
  modified:
    - apps/backend/src/routes/category.routes.ts
    - apps/backend/tests/fixtures/testUser.ts
    - apps/backend/tests/auth.enforcement.test.ts

key-decisions:
  - "Fixed 3 pre-existing auth.enforcement.test.ts tests that used unroled createTestUser against now-enforced /api/categories routes — granted SYSTEM_ADMIN via createTestUserWithRoles (Rule 1: bug directly caused by this plan's own enforcement change)"
  - "This worktree required its own pnpm install, prisma generate, and copied .env (all gitignored/fresh-worktree artifacts) before any test could run"

requirements-completed: [RBAC-03, RBAC-04, RBAC-06]

# Metrics
duration: 30min
completed: 2026-09-14
---

# Phase 02 Plan 02: RBAC Enforcement Middleware Summary

**`requirePermission(code)` middleware backed by a DB-derived, per-request-memoized permission-union query in `role.model.ts`, proven end-to-end on `category.routes.ts` as the first fully permission-enforced module.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-14T03:00:00Z (approx, after worktree reset/setup)
- **Completed:** 2026-09-14T03:13:00Z
- **Tasks:** 2
- **Files modified:** 8 (5 created, 3 modified)

## Accomplishments

- Created `apps/backend/src/models/role.model.ts` exporting `RoleModel.getUserPermissionCodes` (permission-union set, re-queried from the DB every call) and `RoleModel.getUserRoleCodes` (role-code list, pre-built for later plans 02-11/02-12)
- Created `apps/backend/src/middleware/permission.ts` exporting `requirePermission(code)`, mirroring `auth.ts`'s exact interface-extension + `HttpError` conventions, with `req.permissions ??= ...` per-request memoization (confirmed via grep, not a cross-request cache)
- Extended `apps/backend/tests/fixtures/testUser.ts` with `createTestUserWithRoles(suffix, roleCodes, password?)`
- Wired `requirePermission("CATEGORY_VIEW"/"CATEGORY_CREATE"/"CATEGORY_EDIT"/"CATEGORY_DELETE")` onto all 5 routes in `category.routes.ts`, immediately after `requireAuth`, with no route restructuring
- Proved permission union (2-role user has both roles' permissions, not just one) in `rbac.permissionUnion.test.ts`
- Proved DB re-derivation / no-caching (`rbac.revocation.test.ts`): same access token denied -> granted after live `UserRole` create -> denied again after live `UserRole` delete, with zero re-login at any step
- Proved per-route enforcement (`rbac.enforcement.test.ts`, `describe.each` table of 4 method/path/code cases): denied users get 403, allowed users never get 403
- Fixed 3 pre-existing `auth.enforcement.test.ts` tests broken by this plan's own enforcement change (they used role-less `createTestUser` against now-permission-gated `/api/categories` routes)
- Full backend suite verified: 78 tests across 18 files pass (1 intentional skip — the enforcement table's GET case has no `deniedRole` since `CATEGORY_VIEW` is granted to all roles)

## Task Commits

Each task was committed atomically:

1. **Task 1: role.model.ts + requirePermission middleware + fixture + union/revocation tests** - `72e8a50` (feat)
2. **Task 2: wire requirePermission onto category.routes.ts + enforcement test + fix broken pre-existing tests** - `835d43d` (feat)

## Files Created/Modified

- `apps/backend/src/models/role.model.ts` - `RoleModel.getUserPermissionCodes`/`getUserRoleCodes`, both querying the DB fresh on every call
- `apps/backend/src/middleware/permission.ts` - `requirePermission(code)` and exported `PermissionRequest` interface
- `apps/backend/tests/fixtures/testUser.ts` - added `createTestUserWithRoles`
- `apps/backend/src/routes/category.routes.ts` - added `requirePermission` to all 5 routes
- `apps/backend/tests/rbac.permissionUnion.test.ts` - new, proves permission union across 2 roles
- `apps/backend/tests/rbac.revocation.test.ts` - new, proves same-token before/after role grant/revoke behavior
- `apps/backend/tests/rbac.enforcement.test.ts` - new, table-driven 403/not-403 assertions across all 4 mutating/view category routes
- `apps/backend/tests/auth.enforcement.test.ts` - modified 3 tests to grant `SYSTEM_ADMIN` (via `createTestUserWithRoles`) since they now hit permission-gated category routes

## Decisions Made

- Granted `SYSTEM_ADMIN` to the 3 previously-role-less test users in `auth.enforcement.test.ts` rather than leaving them broken — this is a direct correctness fix caused by wiring `requirePermission` onto the routes those tests exercise (Rule 1).
- Environment setup: ran `pnpm install`, `npx prisma generate` (interactive `pnpm approve-builds` prompt could not be automated non-interactively in this shell, so `prisma generate` was invoked directly instead — client generation succeeded without needing the postinstall build-script approval), and copied the gitignored `apps/backend/.env` from the main checkout. None of these are tracked/committed changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing `auth.enforcement.test.ts` tests broken by category-route enforcement**
- **Found during:** Task 2, full-suite verification after wiring `requirePermission` onto `category.routes.ts`
- **Issue:** `CATEGORY_CREATE`/`CATEGORY_EDIT`/`CATEGORY_DELETE` are `SYSTEM_ADMIN`-only per the seeded matrix, and `CATEGORY_VIEW` requires any assigned role — but 3 existing tests in `auth.enforcement.test.ts` used `createTestUser` (which assigns zero roles), causing them to newly fail with 403 instead of their expected 200/201 status
- **Fix:** Switched those 3 tests to `createTestUserWithRoles(suffix, ["SYSTEM_ADMIN"])`
- **Files modified:** `apps/backend/tests/auth.enforcement.test.ts`
- **Commit:** `835d43d`

## TDD Gate Compliance

Task 1 was marked `tdd="true"`, but the plan's own `<action>` steps for Task 1 specify creating the model, middleware, fixture, and both test files together (the plan explicitly notes `rbac.revocation.test.ts` "will only pass once Task 2 lands" — i.e. test-then-implementation-then-more-tests is interleaved by design, not a strict RED-before-GREEN single-feature cycle). No separate `test(...)`-only commit preceded a `feat(...)`-only commit; both were included in a single `feat(02-02)` commit for each task, matching the file-grouping the plan itself specifies. `rbac.permissionUnion.test.ts` was confirmed passing immediately (implementation and test built together), and `rbac.revocation.test.ts` was confirmed passing only after Task 2's route-wiring commit landed, consistent with the plan's stated dependency.

## Issues Encountered

- This worktree lacked `node_modules`, a generated Prisma client, and `.env` (all expected for a fresh worktree). Resolved via `pnpm install`, `npx prisma generate` (direct invocation, since the interactive `pnpm approve-builds` TUI prompt could not be driven non-interactively), and copying `.env` from the main checkout. No plan or code changes were required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `requirePermission` and `RoleModel` are now the proven, reusable enforcement primitives for the remaining ~10 route files in later Phase 02 plans.
- `RoleModel.getUserRoleCodes` is built and unused by this plan but ready for plan 02-11 (self-lockout guard) and plan 02-12 (`GET /api/auth/me`).
- No blockers identified for subsequent plans in this phase.

---
*Phase: 02-rbac-audit-logging*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: apps/backend/src/models/role.model.ts
- FOUND: apps/backend/src/middleware/permission.ts
- FOUND: apps/backend/tests/rbac.permissionUnion.test.ts
- FOUND: apps/backend/tests/rbac.revocation.test.ts
- FOUND: apps/backend/tests/rbac.enforcement.test.ts
- FOUND: apps/backend/src/routes/category.routes.ts
- FOUND commit: 72e8a50 (feat: role.model.ts + requirePermission middleware)
- FOUND commit: 835d43d (feat: category.routes.ts wired with requirePermission)
