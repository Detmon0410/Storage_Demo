---
phase: 02-rbac-audit-logging
plan: 05
subsystem: backend
tags: [express, rbac, permission, vitest]

# Dependency graph
requires:
  - phase: 02-rbac-audit-logging
    plan: 02
    provides: requirePermission(code) middleware, createTestUserWithRoles fixture, RoleModel permission-union query
provides:
  - "*_VIEW permission enforcement on GET routes for customer, customerLicense, dashboardKpi, license, and supplier modules"
  - "rbac.enforcement.reads.batchA.test.ts, a parameterized role-matrix test covering all 5 modules' GET routes"
affects: [02-08 (write-permission wiring for these same 5 modules)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "requirePermission(\"X_VIEW\") inserted immediately after requireAuth on GET / and GET /:id only, mirroring the category.routes.ts reference implementation from plan 02-02"
    - "describe.each/it.each with a conditional it.skip for the deniedRole case, matching rbac.enforcement.test.ts's established pattern"

key-files:
  created:
    - apps/backend/tests/rbac.enforcement.reads.batchA.test.ts
  modified:
    - apps/backend/src/routes/customer.routes.ts
    - apps/backend/src/routes/customerLicense.routes.ts
    - apps/backend/src/routes/dashboardKpi.routes.ts
    - apps/backend/src/routes/license.routes.ts
    - apps/backend/src/routes/supplier.routes.ts
    - apps/backend/tests/license.test.ts

key-decisions:
  - "Fixed license.test.ts's shared authToken() helper to use createTestUserWithRoles(suffix, [\"SYSTEM_ADMIN\"]) instead of role-less createTestUser, since 3 of its GET assertions started failing with 403 after LICENSE_VIEW enforcement landed on GET /api/licenses and GET /api/licenses/:id (Rule 1: bug directly caused by this plan's own enforcement change)"
  - "This worktree required its own pnpm install and a copied apps/backend/.env (both gitignored/fresh-worktree artifacts) before any test could run; also required running prisma generate from apps/backend directly (root-level npx picked up a mismatched global prisma CLI version)"

requirements-completed: [RBAC-04]

# Metrics
duration: 35min
completed: 2026-09-14
---

# Phase 02 Plan 05: RBAC Read Enforcement (Batch A) Summary

**`requirePermission("<MODULE>_VIEW")` wired onto the GET routes of customer, customerLicense, dashboardKpi, license, and supplier — proven correct by a parameterized 5-case enforcement test including the SALES_OFFICER-denied-on-suppliers case.**

## Performance

- **Duration:** ~35 min (including worktree environment setup)
- **Started:** 2026-09-14T10:15:00Z (approx)
- **Completed:** 2026-09-14T10:23:00Z
- **Tasks:** 2
- **Files modified:** 6 (1 created, 5 modified) + 1 pre-existing test fixed

## Accomplishments

- Wired `requirePermission("CUSTOMER_VIEW")`, `requirePermission("CUSTOMER_LICENSE_VIEW")`, `requirePermission("DASHBOARD_VIEW")`, `requirePermission("LICENSE_VIEW")`, and `requirePermission("SUPPLIER_VIEW")` onto each module's `GET /` and `GET /:id` routes only, immediately after `requireAuth`
- Left `customerLicense.routes.ts`'s `POST /:id/renew` route untouched (deferred to plan 02-08 as a write action), and left all other POST/PUT/DELETE routes across all 5 files unchanged
- Wrote `rbac.enforcement.reads.batchA.test.ts` with an `it.each`-style parameterized table covering all 5 modules; proved the one asymmetric case in the matrix — `SALES_OFFICER` is denied 403 on `/api/suppliers` while `IMPORT_COMPLIANCE_OFFICER` is allowed
- Confirmed `npx tsc --noEmit -p .` passes with zero errors after all route edits
- Confirmed the full backend suite (23 test files, 92 passed + 5 intentionally skipped) passes clean on a second run, after fixing one collateral test breakage

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire *_VIEW permission onto GET routes for customer, customerLicense, dashboardKpi** - `d9c8046` (feat)
2. **Task 2: Wire *_VIEW permission onto GET routes for license, supplier; parameterized test** - `d09e5f1` (feat)
3. **[Rule 1 fix] license.test.ts collateral breakage** - `9dae91c` (fix)

## Files Created/Modified

- `apps/backend/src/routes/customer.routes.ts` - added `requirePermission("CUSTOMER_VIEW")` to both GET routes
- `apps/backend/src/routes/customerLicense.routes.ts` - added `requirePermission("CUSTOMER_LICENSE_VIEW")` to both GET routes; renew route untouched
- `apps/backend/src/routes/dashboardKpi.routes.ts` - added `requirePermission("DASHBOARD_VIEW")` to both GET routes
- `apps/backend/src/routes/license.routes.ts` - added `requirePermission("LICENSE_VIEW")` to both GET routes
- `apps/backend/src/routes/supplier.routes.ts` - added `requirePermission("SUPPLIER_VIEW")` to both GET routes
- `apps/backend/tests/rbac.enforcement.reads.batchA.test.ts` - new parameterized test, 5 module cases, 1 with a denied-role assertion
- `apps/backend/tests/license.test.ts` - switched shared `authToken()` helper from `createTestUser` to `createTestUserWithRoles(suffix, ["SYSTEM_ADMIN"])`

## Decisions Made

- Fixed `license.test.ts`'s 3 GET-route assertions that broke as a direct, expected consequence of this plan's own `LICENSE_VIEW` enforcement (Rule 1 — matches the precedent set in plan 02-02's `auth.enforcement.test.ts` fix).
- Environment setup: this worktree had no `node_modules`, generated Prisma client, or `.env`. Ran `pnpm install` (root), then `npx prisma generate` from inside `apps/backend` specifically (running it from the repo root picked up an incompatible global Prisma 7 CLI that rejected the project's Prisma 6-style `schema.prisma` `url` property), and copied the gitignored `apps/backend/.env` from the main checkout. None of these are tracked/committed changes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `license.test.ts` GET assertions broken by `LICENSE_VIEW` enforcement**
- **Found during:** Task 2, full-suite verification after wiring `requirePermission("LICENSE_VIEW")` onto `license.routes.ts`
- **Issue:** `license.test.ts`'s shared `authToken()` helper used role-less `createTestUser`, which 3 GET-based assertions (`GET /api/licenses/:id` x2, `GET /api/licenses`) relied on with an expectation of `200` — now correctly rejected with `403` since those routes require `LICENSE_VIEW`
- **Fix:** Switched `authToken()` to `createTestUserWithRoles(suffix, ["SYSTEM_ADMIN"])`
- **Files modified:** `apps/backend/tests/license.test.ts`
- **Commit:** `9dae91c`

### Notes (not deviations)

- The plan's Task 1 acceptance criterion `grep -c "requirePermission" apps/backend/src/routes/customerLicense.routes.ts` returns `2` is stated inaccurately in the plan: the actual grep-matching-line count is `3` (the `import { requirePermission } ...` line itself also matches the bare string `"requirePermission"`, in addition to the 2 `requirePermission("CUSTOMER_LICENSE_VIEW")` calls on the GET routes). The underlying intent — that the `renew` route remains untouched, with exactly 2 permission-gated GET routes — is correctly satisfied; this is a plan-authoring quirk in the literal grep command, not a code defect.
- One full-suite run showed a single transient failure in `tests/audit.crud.test.ts` (`Category CRUD audit logging`), a file untouched by this plan. Re-running that file alone passed immediately, and a subsequent full-suite run passed 23/23 files clean. This is attributed to concurrent parallel-executor DB contention (this plan ran alongside sibling plans 02-06 and 02-07 in separate worktrees against a shared dev database) — not a regression introduced by this plan.

## Issues Encountered

- Fresh worktree lacked `node_modules`, generated Prisma client, and `.env`. Resolved via `pnpm install`, `npx prisma generate` (run specifically from `apps/backend`, since root-level `npx` resolved a mismatched global Prisma 7 CLI incompatible with the project's Prisma 6 schema syntax), and copying `.env` from the main checkout. No plan or code changes required.
- One transient cross-worktree test failure (see Notes above), resolved by re-verification; no code change needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 5 modules in this plan (`customer`, `customerLicense`, `dashboardKpi`, `license`, `supplier`) now have proven, non-lockout-inducing `*_VIEW` enforcement on their GET routes, matching the same pattern established by plan 02-02's `category.routes.ts` reference implementation.
- Write-side (POST/PUT/DELETE/renew) permission wiring and audit-log wrapping for these same 5 modules is deferred to plan 02-08 per the staged rollout in RESEARCH.md Pattern 3 — no blockers for that plan.
- No blockers identified for the rest of Phase 02.

---
*Phase: 02-rbac-audit-logging*
*Completed: 2026-09-14*

## Self-Check: PASSED

- FOUND: apps/backend/src/routes/customer.routes.ts
- FOUND: apps/backend/src/routes/customerLicense.routes.ts
- FOUND: apps/backend/src/routes/dashboardKpi.routes.ts
- FOUND: apps/backend/src/routes/license.routes.ts
- FOUND: apps/backend/src/routes/supplier.routes.ts
- FOUND: apps/backend/tests/rbac.enforcement.reads.batchA.test.ts
- FOUND: apps/backend/tests/license.test.ts
- FOUND commit: d9c8046 (feat: customer/customerLicense/dashboardKpi GET routes wired)
- FOUND commit: d09e5f1 (feat: license/supplier GET routes wired + batch A test)
- FOUND commit: 9dae91c (fix: license.test.ts SYSTEM_ADMIN test user)
