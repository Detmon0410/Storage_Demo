---
phase: 02-rbac-audit-logging
plan: 03
subsystem: audit-logging
tags: [prisma, vitest, audit-log, transactions, supertest]

# Dependency graph
requires:
  - phase: 02-rbac-audit-logging (plan 01)
    provides: AuditLog Prisma model, RBAC schema pushed to shared dev database
provides:
  - "AuditLogModel.record(client, params) — the single reusable audit-write utility, accepting either PrismaClient or Prisma.TransactionClient"
  - Reference pattern (find-before, mutate, record-after, all inside one prisma.$transaction) for every later write-wave controller in this phase
  - Audited Category CRUD (create/update/delete) and audited login/logout
affects: [02-08, 02-09, 02-10 (later write-wave plans replicating this pattern), approval-workflow phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AuditLogModel.record(tx, {...}) called inside the same prisma.$transaction as the paired mutation — atomic by construction, no separate commit step"
    - "jsonSafe() helper (JSON.parse(JSON.stringify(value))) normalizes Decimal/Date fields before they reach the Json column"
    - "Standalone (non-transactional) audit calls use AuditLogModel.record(prisma, {...}) directly for single-insert actions like login/logout that have no paired mutation to wrap"

key-files:
  created:
    - apps/backend/src/lib/audit.ts
    - apps/backend/tests/audit.crud.test.ts
    - apps/backend/tests/audit.atomicity.test.ts
    - apps/backend/tests/audit.actions.test.ts
  modified:
    - apps/backend/src/controllers/category.controller.ts
    - apps/backend/src/controllers/auth.controller.ts

key-decisions:
  - "Copied apps/backend/.env from the main checkout into this worktree (gitignored, not tracked) and ran pnpm install + npx prisma generate since this worktree had no node_modules/.env — required before any test or type-check could run"
  - "logout's audit call is guarded by both `raw` (valid refresh cookie present) and `req.userId` (authenticated) — matches plan's T-02-09 accept disposition: no valid session means no identity to attribute the event to, not a gap"

patterns-established:
  - "Controller-level prisma.$transaction wrapping tx.<model>.create/update/delete() plus AuditLogModel.record(tx, ...) is the exact template every later controller in this phase (02-08, 02-09, 02-10) should replicate"

requirements-completed: [AUDIT-01, AUDIT-02]

# Metrics
duration: 30min
completed: 2026-09-14
---

# Phase 02 Plan 03: Audit Logging Utility + Category/Auth Wiring Summary

**Single reusable `AuditLogModel.record` utility proven atomic (one `prisma.$transaction` per mutation+audit pair) and Decimal/Date-safe via `JSON.parse(JSON.stringify())`, replicated onto Category CRUD and login/logout as the reference implementation for later Phase 02 controllers.**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-09-14T02:42:00Z (approx)
- **Completed:** 2026-09-14T03:12:52Z
- **Tasks:** 2
- **Files modified:** 6 (3 created in Task 1, 2 modified + 1 created in Task 2)

## Accomplishments
- Built `apps/backend/src/lib/audit.ts` exporting `AuditLogModel.record(client, params)`, accepting either the singleton `PrismaClient` or a `Prisma.TransactionClient`, with a `jsonSafe()` helper that round-trips `before`/`after` snapshots through `JSON.parse(JSON.stringify(...))` to safely serialize `Decimal`/`Date` values into the `Json` column
- Rewrote `createCategory`/`updateCategory`/`deleteCategory` to open a controller-level `prisma.$transaction`, mutate via `tx.category.*()`, and call `AuditLogModel.record(tx, {...})` in the same transaction — proving the atomicity property required by AUDIT-01
- Wired `login`/`logout` in `auth.controller.ts` to call `AuditLogModel.record(prisma, {...})` directly (no `$transaction`, since each is a standalone insert) — proving the utility's other required call shape
- Proved atomicity directly: a duplicate `categoryCode` create (409, `@unique` violation) inside the transaction leaves zero new rows in both `Category` and `AuditLog`
- All 3 new test files (5 tests total) pass; full backend suite (18 files, 73 tests) passes with no regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: AuditLogModel.record utility with Decimal/Date-safe serialization** - `d2fbd43` (feat)
2. **Task 2: Wrap category CRUD in audited transactions; emit login/logout audit events** - `2013f28` (feat)

## Files Created/Modified
- `apps/backend/src/lib/audit.ts` - `AuditLogModel.record()` + `jsonSafe()` serialization helper
- `apps/backend/tests/audit.crud.test.ts` - proves create/update produce correct AuditLog rows with entity/action/before/after
- `apps/backend/tests/audit.atomicity.test.ts` - proves a failed mutation (duplicate categoryCode) leaves zero new Category and AuditLog rows
- `apps/backend/tests/audit.actions.test.ts` - proves login/logout each produce a distinct AuditLog row
- `apps/backend/src/controllers/category.controller.ts` - createCategory/updateCategory/deleteCategory now transactional + audited
- `apps/backend/src/controllers/auth.controller.ts` - login/logout now call `AuditLogModel.record(prisma, ...)` directly

## Decisions Made
- This worktree had no `node_modules` or `.env` (fresh worktree checkout, both gitignored); ran `pnpm install` and `npx prisma generate` (RBAC schema was already pushed to the shared dev DB by plan 02-01, so no `db push` was needed here), and copied `apps/backend/.env` from the main checkout — none of these are tracked by git or part of any commit.
- Followed the plan's exact guard for logout's audit call: only record when both a valid refresh cookie (`raw`) and an authenticated `req.userId` are present, matching the threat model's T-02-09 "accept" disposition (no valid session = nothing to log, not a gap).

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched their `<action>` blocks precisely, including the exact code shapes given in the plan for `category.controller.ts` and the `auth.controller.ts` login/logout wiring.

## Issues Encountered
- Fresh git worktree lacked `node_modules` and `.env` (expected, both gitignored). Resolved via `pnpm install` and copying `.env` from the main checkout; ran `npx prisma generate` to regenerate the Prisma Client against the schema already pushed by plan 02-01 (no schema changes or `db push` needed in this plan). No plan or code changes required.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- `AuditLogModel.record` and its transactional wiring pattern (find-before, mutate, record-after, all inside one `tx`) are now proven and ready to replicate onto every other mutating controller in this phase (product, supplier, customer, import order, sales order, license, user/role management — plans 02-08, 02-09, 02-10 per the roadmap).
- Login/logout audit events (AUDIT-02) are live; the same `AuditLogModel.record(prisma, ...)` standalone-call shape is available for any other non-transactional single-insert audit event.
- No blockers identified for later plans in this phase. Ran alongside parallel plans 02-02 (permission middleware) and 02-04 (tx-client refactor) in sibling worktrees — no file overlap, no merge conflicts expected against `apps/backend/src/lib/audit.ts`, `category.controller.ts`, or `auth.controller.ts`.

---
*Phase: 02-rbac-audit-logging*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: apps/backend/src/lib/audit.ts
- FOUND: apps/backend/tests/audit.crud.test.ts
- FOUND: apps/backend/tests/audit.atomicity.test.ts
- FOUND: apps/backend/tests/audit.actions.test.ts
- FOUND commit: d2fbd43 (feat: AuditLogModel.record utility)
- FOUND commit: 2013f28 (feat: audited category CRUD + login/logout)
