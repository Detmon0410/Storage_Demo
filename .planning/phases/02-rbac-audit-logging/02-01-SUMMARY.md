---
phase: 02-rbac-audit-logging
plan: 01
subsystem: database
tags: [prisma, mysql, rbac, seed, vitest]

# Dependency graph
requires:
  - phase: 01-auth
    provides: users table, admin user seed, auth middleware
provides:
  - Role, Permission, UserRole, RolePermission, AuditLog Prisma models (additive)
  - createdById on ImportOrder/SalesOrder (nullable, for future no-self-approval checks)
  - 6 roles, 45 permission codes, role-permission matrix seeded into the live database
  - admin user assigned SYSTEM_ADMIN role
affects: [02-rbac-enforcement plans, audit-logging plans, approval-workflow phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent seed via upsert keyed on unique roleCode/permissionCode/composite user_role+role_permission keys"
    - "RBAC seed logic runs outside the existing bulk-delete $transaction block since it targets unrelated tables"

key-files:
  created:
    - apps/backend/tests/rbac.seed.test.ts
  modified:
    - apps/backend/prisma/schema.prisma
    - apps/backend/prisma/seed.ts

key-decisions:
  - "Ran pnpm install + pnpm approve-builds in this worktree since node_modules was absent (fresh worktree checkout) — required before any prisma command could run"
  - "Copied apps/backend/.env from the main checkout into the worktree (gitignored, not tracked) so DATABASE_URL was available for prisma db push/seed"

patterns-established:
  - "Compound Prisma upsert where-clause names follow auto-generated convention (userId_roleId, roleId_permissionId) — confirmed via live client error message"

requirements-completed: [RBAC-01]

# Metrics
duration: 25min
completed: 2026-09-14
---

# Phase 02 Plan 01: RBAC Schema + Seed Summary

**Prisma schema extended with Role/Permission/UserRole/RolePermission/AuditLog models and createdById tracking fields; database seeded with 6 roles and 45 permission codes mapped per the role doc's §7 matrix, with the admin user assigned SYSTEM_ADMIN.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-14T10:00:00Z (approx)
- **Completed:** 2026-09-14T10:25:00Z (approx)
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Added 5 new additive Prisma models (Role, Permission, UserRole, RolePermission, AuditLog) plus 4 new relation fields on `User` and nullable `createdById` on `ImportOrder`/`SalesOrder`, with zero changes to existing fields/mappings
- Pushed the schema to the live dev MySQL database (`prisma db push`, no data-loss prompt — purely additive) and regenerated the Prisma Client
- Seeded 6 roles, 45 permission codes, the full role→permission matrix, and the admin→SYSTEM_ADMIN assignment via idempotent `upsert` calls
- Wrote `rbac.seed.test.ts` (3 assertions) proving role count/codes, admin role assignment, and 3 representative permission-to-role mappings (PRODUCT_VIEW/USER_MANAGEMENT_FULL/IMPORT_ORDER_APPROVE)
- Followed RED/GREEN TDD gate: test committed first against the empty (pre-seed) database and confirmed failing on all 3 assertions, then seed logic committed and test re-run to confirm all 3 pass
- Verified full backend suite (68 tests across 15 files) still passes — no regression to Phase 1 auth tests
- Verified seed re-run is idempotent (no error on second run)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add RBAC + audit-log Prisma models and createdById fields** - `ad69ca3` (feat)
2. **Task 2: [BLOCKING] Push schema to the database** - no file diff (schema push + client regen only, verified via `npx prisma db push` and a Node script confirming `prisma.role`/`prisma.auditLog` exist)
3. **Task 3 (RED): add failing rbac.seed.test.ts** - `3d934fb` (test)
4. **Task 3 (GREEN): seed 6 roles/45 permissions/matrix, assign admin SYSTEM_ADMIN** - `b9de700` (feat)

## Files Created/Modified
- `apps/backend/prisma/schema.prisma` - Added Role, Permission, UserRole, RolePermission, AuditLog models; added createdById to ImportOrder/SalesOrder; added 4 relation fields to User
- `apps/backend/prisma/seed.ts` - Added `roles`/`permissions` data arrays and `seedRbac()` idempotent upsert logic, invoked after the admin-user seed block
- `apps/backend/tests/rbac.seed.test.ts` - 3 vitest assertions proving RBAC-01 seed correctness against the live dev database

## Decisions Made
- This worktree had no `node_modules` installed (fresh checkout); ran `pnpm install` and `pnpm approve-builds` (approving `@prisma/client`, `@prisma/engines`, `esbuild`, `prisma` build scripts) before any Prisma command would function.
- Copied the gitignored `apps/backend/.env` from the main checkout into this worktree so `DATABASE_URL` was available — this file is not tracked by git and was not part of any commit.

## Deviations from Plan

None - plan executed exactly as written. The TDD gate sequence (test committed and confirmed failing against the empty database, then implementation committed and confirmed passing) was followed per the plan's `tdd="true"` requirement on Task 3.

## TDD Gate Compliance

- RED gate: `3d934fb` (`test(02-01): add failing test for RBAC seed correctness`) — confirmed all 3 assertions failed before seed logic existed in the applied database state
- GREEN gate: `b9de700` (`feat(02-01): seed 6 roles, 45 permissions, role-permission matrix, admin SYSTEM_ADMIN`) — confirmed all 3 assertions pass after running the seed
- No REFACTOR commit was needed (seed logic required no cleanup pass)

## Issues Encountered
- This worktree lacked installed dependencies and a `.env` file (both expected in a fresh git worktree, since `node_modules` and `.env` are gitignored). Resolved by running `pnpm install`, approving Prisma's build scripts via `pnpm approve-builds`, and copying `.env` from the main checkout. No plan or code changes were needed to resolve this — purely local environment setup.

## User Setup Required

None - no external service configuration required. The RBAC schema and seed data are entirely internal to the existing MySQL database.

## Next Phase Readiness
- The database now has a stable RBAC foundation (6 roles, 45 permissions, role-permission matrix, admin's SYSTEM_ADMIN assignment) that every later plan in Phase 02 (permission middleware, `requirePermission` route guards, audit-log writes) can build on.
- `createdById` is now available on `ImportOrder`/`SalesOrder` (currently always null for pre-existing rows) for the no-self-approval check planned in a later plan (02-10 per the plan's interface comments).
- No blockers identified for the next plan in this phase.

---
*Phase: 02-rbac-audit-logging*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: apps/backend/prisma/schema.prisma
- FOUND: apps/backend/prisma/seed.ts
- FOUND: apps/backend/tests/rbac.seed.test.ts
- FOUND commit: ad69ca3 (feat: RBAC + audit-log Prisma models)
- FOUND commit: 3d934fb (test: failing RBAC seed test, RED)
- FOUND commit: b9de700 (feat: RBAC seed logic, GREEN)
