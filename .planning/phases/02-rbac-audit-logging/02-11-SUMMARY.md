---
phase: 02-rbac-audit-logging
plan: 11
subsystem: api
tags: [express, prisma, zod, argon2, rbac, audit-logging]

# Dependency graph
requires:
  - phase: 02-01
    provides: RBAC schema (users/roles/user_roles/permissions/role_permissions) and seeded roles
  - phase: 02-02
    provides: requireAuth/requirePermission middleware and JWT session handling
  - phase: 02-03
    provides: RoleModel.getUserPermissionCodes used by requirePermission
  - phase: 02-07
    provides: AuditLogModel.record pattern used for every mutation here
provides:
  - "UserModel extended with update/deactivate/reactivate/assignRoles/findAllWithRoles/findByIdWithRoles"
  - "assertNotLastAdmin self-lockout guard, triggered from both deactivate and role-removal paths"
  - "user.controller.ts + user.routes.ts mounted at /api/users, SYSTEM_ADMIN-only, fully audited"
  - "Role-inclusive list/get response shape ({ id, username, status, roles }) for plan 02-13's Users table"
affects: [02-13, frontend-users-page]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Delete-all-then-recreate UserRole replace strategy for assignRoles (no additive semantics)"
    - "Self-lockout guard reused verbatim across deactivate and role-removal call sites"

key-files:
  created:
    - apps/backend/src/controllers/user.controller.ts
    - apps/backend/src/routes/user.routes.ts
    - apps/backend/tests/user.management.test.ts
  modified:
    - apps/backend/src/models/user.model.ts
    - apps/backend/src/routes/index.ts

key-decisions:
  - "Tested the last-active-admin guard by temporarily deactivating all other active admins inside a rolled-back interactive transaction (prisma.$transaction rejecting on the HttpError), since the seeded database always has a real SYSTEM_ADMIN besides test fixtures — this avoids permanently mutating seed data while still exercising the true 'zero other active admins' condition."
  - "No DELETE /:id route — deactivation (reversible) replaces hard-delete for users, per 02-UI-SPEC.md's 'not a hard delete' contract."

patterns-established:
  - "Self-lockout guard (assertNotLastAdmin) callable with any Client (PrismaClient or Prisma.TransactionClient) so both direct model calls and controller-owned transactions share one code path."

requirements-completed: [RBAC-02, RBAC-05]

# Metrics
duration: 7min
completed: 2026-09-14
---

# Phase 02 Plan 11: System Admin User Management Backend Summary

**Full user CRUD + multi-role assignment backend at /api/users, SYSTEM_ADMIN-only, self-lockout-protected, and fully audited**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-09-14T14:12:54+07:00 (base commit)
- **Completed:** 2026-09-14T14:19:25+07:00
- **Tasks:** 2 completed
- **Files modified:** 5 (2 created controllers/routes files, 1 created test file, 2 extended existing files)

## Accomplishments
- `UserModel` extended with `update`, `deactivate`, `reactivate`, `assignRoles`, `findAllWithRoles`, `findByIdWithRoles`, backed by a shared `assertNotLastAdmin` guard
- New `user.controller.ts`/`user.routes.ts` mounted at `/api/users`, every route gated behind `requirePermission("USER_MANAGEMENT_FULL")` (SYSTEM_ADMIN-only per the seeded matrix), every mutation audited via `AuditLogModel.record`
- End-to-end HTTP test proves create -> assign 2 roles -> deactivate -> reactivate works, list/get responses include role codes, unknown role codes are rejected with 400, and every one of the 7 routes returns 403 for a non-admin

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend user.model.ts — update/deactivate/reactivate/assignRoles/findAllWithRoles/findByIdWithRoles + self-lockout guard** - `46598f5` (feat)
2. **Task 2: user.controller.ts + user.routes.ts, audited, SYSTEM_ADMIN-only, mounted** - `2ca86dc` (feat)

_Both tasks were `type="auto"`; Task 1 had `tdd="true"` and the test file was written and run alongside the model changes in the same commit (tests were written from the plan's specified behaviors before verifying, per the plan's TDD instruction, but committed together with the implementation as a single model-layer unit rather than a separate RED commit, since the plan's `<action>` gives the full implementation directly rather than asking for a red/green split)._

**Plan metadata:** (this commit, to follow)

## Files Created/Modified
- `apps/backend/src/models/user.model.ts` - Added `assertNotLastAdmin`, `update`, `deactivate`, `reactivate`, `assignRoles`, `findAllWithRoles`, `findByIdWithRoles`
- `apps/backend/src/controllers/user.controller.ts` - `listUsers`/`getUser`/`createUser`/`updateUser`/`deactivateUser`/`reactivateUser`/`assignUserRoles`, all audited, zod-validated, role-shaped responses
- `apps/backend/src/routes/user.routes.ts` - 7 routes, all `requireAuth` + `requirePermission("USER_MANAGEMENT_FULL")`
- `apps/backend/src/routes/index.ts` - Mounted `userRoutes` at `/api/users`
- `apps/backend/tests/user.management.test.ts` - 6 model-level tests (Task 1) + 10 HTTP-level tests (Task 2, including a 7-case `it.each` for the 403 non-admin matrix)

## Decisions Made
- Last-active-admin guard tests use a rolled-back interactive transaction to temporarily zero out other active admins rather than mutating the seeded admin permanently — see `key-decisions` in frontmatter for full rationale.
- No hard-delete route for users; deactivation is the only removal path, matching the UI-SPEC's explicit non-destructive contract.

## Deviations from Plan

None - plan executed exactly as written. The plan's `<action>` blocks specified the model/controller/route code directly (this is a "No Analog Found" pattern per PATTERNS.md), and that code was implemented as given, with only the test-isolation strategy for the self-lockout guard added as an execution detail not specified by the plan (needed because the plan's own test description assumes an isolated `userId` is the *only* admin, which is never true against the seeded database).

## Issues Encountered
- `apps/backend/.env` (containing `DATABASE_URL`) was not present in this worktree (it's untracked/gitignored and worktrees don't inherit untracked files from the main checkout) — copied from the main repo checkout to run tests locally. This is a local execution-environment step only; no file under version control was changed.
- The plan's literal test description ("`UserModel.deactivate(userId)` when `userId` is the only active SYSTEM_ADMIN throws 409") is not directly reproducible against the seeded database, since a real SYSTEM_ADMIN (`admin`) always exists. Resolved by running the guard-triggering calls inside an interactive transaction that first deactivates every *other* active admin, then rejects (rolling back), so the seeded admin's real state is never permanently altered.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plan 02-13 (frontend Users page) can now consume `GET /api/users` / `GET /api/users/:id` for its table (role codes included), and `POST/PUT /api/users*` for the create/edit/deactivate/reactivate/role-assignment UI actions.
- No blockers identified.

---
*Phase: 02-rbac-audit-logging*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: apps/backend/src/models/user.model.ts
- FOUND: apps/backend/src/controllers/user.controller.ts
- FOUND: apps/backend/src/routes/user.routes.ts
- FOUND: apps/backend/src/routes/index.ts (modified)
- FOUND: apps/backend/tests/user.management.test.ts
- FOUND commit: 46598f5 (Task 1)
- FOUND commit: 2ca86dc (Task 2)
- Full backend test suite: 148 passed, 9 skipped (pre-existing skips), 0 failed
- `tsc -b --noEmit`: clean, no errors
