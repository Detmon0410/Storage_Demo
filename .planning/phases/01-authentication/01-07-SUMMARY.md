---
phase: 01-authentication
plan: 07
subsystem: auth
tags: [express, jwt, middleware, vitest, supertest, staged-rollout]

# Dependency graph
requires:
  - phase: 01-authentication (plan 03)
    provides: "requireAuth middleware (apps/backend/src/middleware/auth.ts), unit-tested but unwired"
  - phase: 01-authentication (plan 04)
    provides: "Live /api/auth/login endpoint used by the new enforcement test to obtain a real access token"
  - phase: 01-authentication (plan 05/06)
    provides: "Frontend already sends Authorization header + credentials on every request, so it is safe to start enforcing 401s on GET"
provides:
  - "Every GET endpoint across all 11 pre-existing route files now requires a valid Bearer access token (401 otherwise)"
  - "auth.enforcement.test.ts — the incremental regression suite that will gain write/destructive assertions in plans 01-08/09"
affects: [01-authentication (plans 01-08/09 will extend the same test file and route files to cover POST/PUT/DELETE enforcement)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Staged rollout (D-08): requireAuth applied per-HTTP-method across the same route files, not as one global switch — GET this plan, writes/destructive in the next two"

key-files:
  created:
    - apps/backend/tests/auth.enforcement.test.ts
  modified:
    - apps/backend/src/routes/category.routes.ts
    - apps/backend/src/routes/customer.routes.ts
    - apps/backend/src/routes/customerLicense.routes.ts
    - apps/backend/src/routes/dashboardKpi.routes.ts
    - apps/backend/src/routes/importOrder.routes.ts
    - apps/backend/src/routes/inventoryStock.routes.ts
    - apps/backend/src/routes/license.routes.ts
    - apps/backend/src/routes/product.routes.ts
    - apps/backend/src/routes/salesOrder.routes.ts
    - apps/backend/src/routes/stockTransaction.routes.ts
    - apps/backend/src/routes/supplier.routes.ts

key-decisions:
  - "Followed the plan's exact interface pattern (import requireAuth, apply only to .get() calls) with no deviation — all 11 route files matched the plan's documented BEFORE-state byte-for-byte, so no adaptation was needed."

requirements-completed: [AUTH-04]

# Metrics
duration: ~15min
completed: 2026-09-03
---

# Phase 1 Plan 07: GET-Route Authentication Enforcement Summary

**requireAuth now gates every GET endpoint across all 11 pre-existing business route files (category, customer, customerLicense, dashboardKpi, importOrder, inventoryStock, license, product, salesOrder, stockTransaction, supplier) — POST/PUT/DELETE remain intentionally open until plans 01-08/09, per the locked D-08 staged rollout.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-09-03
- **Tasks:** 2/2
- **Files modified:** 12 (11 modified route files, 1 new test file)

## Accomplishments
- Added `import { requireAuth } from "../middleware/auth.js";` and applied `requireAuth` to every `.get(...)` call in all 11 route files — confirmed via grep that each file now has exactly 3 occurrences of `requireAuth` (1 import + 2 GET routes)
- Confirmed no `.post(`, `.put(`, or `.delete(` line in any of the 11 files was touched — writes remain open at this stage
- `apps/backend/src/routes/index.ts` untouched (no diff) — only the 11 target route files changed
- New `auth.enforcement.test.ts`: asserts 401 for unauthenticated `GET /api/categories` and `GET /api/products`, 200+array response for `GET /api/categories` with a valid access token obtained via a real login flow, and confirms unauthenticated `POST /api/categories` still succeeds (201) at this stage — with automatic cleanup of the created test category
- Full backend suite: 8 test files, 29/29 passing, zero regressions from plans 01-02 through 01-06

## Task Commits

Each task was committed atomically:

1. **Task 1: Apply requireAuth to every GET route across all 11 route files** - `1ff729d` (feat)
2. **Task 2: auth.enforcement.test.ts (GET enforcement) + full regression run** - `bc8a7fc` (test)

## Files Created/Modified
- `apps/backend/src/routes/category.routes.ts` - `requireAuth` on both GET routes
- `apps/backend/src/routes/customer.routes.ts` - `requireAuth` on both GET routes
- `apps/backend/src/routes/customerLicense.routes.ts` - `requireAuth` on both GET routes (POST `/:id/renew` write untouched)
- `apps/backend/src/routes/dashboardKpi.routes.ts` - `requireAuth` on both GET routes
- `apps/backend/src/routes/importOrder.routes.ts` - `requireAuth` on both GET routes
- `apps/backend/src/routes/inventoryStock.routes.ts` - `requireAuth` on both GET routes
- `apps/backend/src/routes/license.routes.ts` - `requireAuth` on both GET routes
- `apps/backend/src/routes/product.routes.ts` - `requireAuth` on both GET routes
- `apps/backend/src/routes/salesOrder.routes.ts` - `requireAuth` on both GET routes
- `apps/backend/src/routes/stockTransaction.routes.ts` - `requireAuth` on both GET routes
- `apps/backend/src/routes/supplier.routes.ts` - `requireAuth` on both GET routes
- `apps/backend/tests/auth.enforcement.test.ts` - 4-behavior regression suite (2 unauthenticated-GET-401, 1 authenticated-GET-200, 1 unauthenticated-POST-still-open)

## Decisions Made
- No structural deviation from the plan: every one of the 11 route files matched the plan's documented "BEFORE" state exactly (confirmed by reading each file first), so the identical mechanical edit specified in the plan's `<interfaces>` section was applied verbatim to each.
- Copied `apps/backend/.env` from the parent repo into this fresh worktree (already containing `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL`, `ALLOWED_ORIGINS` per prior plans' fixes) — no new values needed.
- Ran `pnpm install` and `npx prisma generate` in this fresh worktree checkout (no `node_modules`, no generated Prisma client present initially).

## Deviations from Plan

None - plan executed exactly as written. All 11 route files matched the plan's documented before-state byte-for-byte; the mechanical transformation was applied identically to each with no adaptation required.

## Issues Encountered

None. Fresh worktree setup (`pnpm install`, `npx prisma generate`, `.env` copy) completed without incident using the same precedent documented in plans 01-01 through 01-06.

## User Setup Required

None - no external service configuration required. Same `.env` gitignore caveat as prior plans: any other clone/worktree needs `DATABASE_URL`, `PORT`, `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL`, `ALLOWED_ORIGINS` in `apps/backend/.env`.

## Next Phase Readiness
- Every GET endpoint across the 11 pre-existing business route files now requires a valid Bearer access token — AUTH-04 partially satisfied (reads only).
- POST/PUT/DELETE on the same 11 route files remain intentionally open — plan 01-08 will extend `requireAuth` to POST/PUT (writes), plan 01-09 will extend it to DELETE (destructive), per the locked D-08 staged-rollout order.
- `auth.enforcement.test.ts` is structured to be incrementally extended: its existing "unauthenticated POST still succeeds" assertion is explicitly flagged in the plan as one that will flip to expect 401 once plan 01-08 lands.
- T-01-16 (Information Disclosure on GET endpoints) is now mitigated per this plan's threat model; T-01-17 (writes still open) remains an accepted, time-boxed transitional state, closed by plans 01-08/09 within the same phase.

## Threat Flags

None - all new surface (requireAuth applied to GET routes across 11 files) was explicitly covered by this plan's `<threat_model>` (T-01-16, T-01-17); no undocumented trust-boundary surface introduced.

---
*Phase: 01-authentication*
*Completed: 2026-09-03*

## Self-Check: PASSED

- FOUND: apps/backend/tests/auth.enforcement.test.ts
- FOUND: commit 1ff729d
- FOUND: commit bc8a7fc
