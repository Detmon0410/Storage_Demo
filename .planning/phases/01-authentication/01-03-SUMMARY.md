---
phase: 01-authentication
plan: 03
subsystem: auth
tags: [express, cors, jwt, middleware, vitest, supertest]

# Dependency graph
requires:
  - phase: 01-authentication (plan 02)
    provides: "signAccessToken/verifyAccessToken JWT helpers, vitest test infrastructure"
provides:
  - "Testable Express app (apps/backend/src/app.ts) importable via supertest without a real network listener"
  - "requireAuth middleware (apps/backend/src/middleware/auth.ts) — built and unit-tested, NOT yet wired to any route"
  - "CORS restricted to ALLOWED_ORIGINS allow-list with credentials support (AUTH-07)"
affects: [01-authentication (later plans: login/refresh/logout endpoints will use app.ts for supertest; requireAuth will be wired to routes in waves 7-9)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "app.ts/index.ts split: app.ts exports the Express app definition for testability, index.ts only owns app.listen()"
    - "requireAuth built and unit-tested in isolation before being wired to any route (staged rollout per D-08)"

key-files:
  created:
    - apps/backend/src/app.ts
    - apps/backend/src/middleware/auth.ts
    - apps/backend/tests/middleware.auth.test.ts
    - apps/backend/tests/auth.cors.test.ts
  modified:
    - apps/backend/src/index.ts
    - apps/backend/.env (gitignored — added JWT_SECRET, JWT_ACCESS_TOKEN_TTL, ALLOWED_ORIGINS)

key-decisions:
  - "Added JWT_SECRET and JWT_ACCESS_TOKEN_TTL to .env (not just ALLOWED_ORIGINS) — this fresh worktree's copied .env only had DATABASE_URL/PORT from the original repo checkout; plan 01-02's env additions were gitignored and never propagated here. Used the same default values documented in apps/backend/src/lib/jwt.ts and 01-02-SUMMARY.md so behavior matches other worktrees exactly."

requirements-completed: [AUTH-07]

# Metrics
duration: ~25min
completed: 2026-09-03
---

# Phase 1 Plan 03: requireAuth Middleware and CORS Allow-List Summary

**requireAuth JWT middleware built and fully unit-tested but deliberately unwired from any route (staged rollout), plus app.ts/index.ts split with CORS locked down to an explicit ALLOWED_ORIGINS allow-list with credentials support.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-03T10:55:00Z
- **Completed:** 2026-09-03T10:58:40Z
- **Tasks:** 2/2
- **Files modified:** 6 (4 created, 2 modified, plus gitignored .env)

## Accomplishments
- `requireAuth` middleware rejects missing/malformed/wrong-secret/expired Bearer tokens with 401 `HttpError`, and attaches `req.userId` on a valid token — all 5 behaviors unit-tested with no HTTP server needed
- Verified via grep that `requireAuth` is not imported by any route file yet — staged rollout preserved for plans 01-07/08/09
- `apps/backend/src/app.ts` now holds the full Express app definition (cors, json, cookieParser, routes, errorHandler), exported for both `index.ts` and `supertest`
- CORS now uses an explicit `ALLOWED_ORIGINS` array with `credentials: true` — never `origin: true` or `origin: "*"` — verified with 3 behaviors (non-allow-listed origin gets no CORS header, allow-listed origin gets matching header + credentials, no-Origin requests still succeed)
- Manually smoke-tested server boot on an alternate port (4000 was occupied by another running process in this environment) — confirmed `/health` still returns `{"status":"ok"}` after the refactor

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): add failing test for requireAuth middleware** - `e65493a` (test)
2. **Task 1 (GREEN): implement requireAuth middleware** - `ce8fd71` (feat)
3. **Task 2 (RED): add failing test for CORS allow-list on app.ts** - `cd4614a` (test)
4. **Task 2 (GREEN): split app.ts from index.ts, restrict CORS to allow-listed origins (AUTH-07)** - `fee70a6` (feat)

## Files Created/Modified
- `apps/backend/src/middleware/auth.ts` - `requireAuth` middleware, exports `AuthenticatedRequest` interface and `requireAuth` function
- `apps/backend/tests/middleware.auth.test.ts` - 5-behavior unit test suite (no-header, wrong-scheme, wrong-secret, expired, valid-token)
- `apps/backend/src/app.ts` - Full Express app definition (cors allow-list, json, cookieParser, routes, errorHandler), exports `app`
- `apps/backend/src/index.ts` - Reduced to listener only; imports `app` from `./app.js`
- `apps/backend/tests/auth.cors.test.ts` - 3-behavior CORS test suite using supertest against `app`
- `apps/backend/.env` (gitignored, not committed) - Added `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL` (missing from this worktree's copy), and `ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`

## Decisions Made
- Copied `apps/backend/.env` from the parent repo working tree into this fresh worktree (same precedent as 01-01/01-02), then discovered it only contained `DATABASE_URL`/`PORT` — plan 01-02's `JWT_SECRET`/`JWT_ACCESS_TOKEN_TTL` additions were gitignored and had not propagated to the parent repo's `.env` either. Added both plus this plan's `ALLOWED_ORIGINS` using the exact default values already hardcoded as fallbacks in `apps/backend/src/lib/jwt.ts` (`JWT_SECRET` fallback) and documented in 01-02-SUMMARY.md, so no new secret values were invented.
- Port 4000 was already occupied by another process in this shared dev environment during the manual server-boot smoke check; ran the boot check on `PORT=4099` instead to get a clean listen, confirmed `/health` returns `{"status":"ok"}`, then killed the process. This is a manual verification step per the plan (not part of automated `<verify>`), so no test file depends on port 4000 being free.
- Reverted an incidental `tsconfig.tsbuildinfo` change (a tracked build-artifact file that changes on every `tsc` invocation) before committing Task 2 — out of scope for this task, no functional content change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added missing JWT_SECRET/JWT_ACCESS_TOKEN_TTL to .env**
- **Found during:** Pre-Task-1 environment setup
- **Issue:** This fresh worktree's `.env` (copied from the parent repo checkout) only had `DATABASE_URL` and `PORT`. Plan 01-02 added `JWT_SECRET`/`JWT_ACCESS_TOKEN_TTL` to `.env`, but since `.env` is gitignored, that addition never reached the parent repo's working tree or this new worktree's copy of it. Without these vars, `signAccessToken`/`verifyAccessToken` (used directly in Task 1's test) would fall back to the hardcoded default in `jwt.ts`, which is functionally fine, but `ALLOWED_ORIGINS` (this plan's own requirement) was also absent.
- **Fix:** Added `JWT_SECRET=dev-only-change-me-in-production-please-32chars-min`, `JWT_ACCESS_TOKEN_TTL=15m` (matching `jwt.ts`'s own fallback defaults, so behavior is identical to relying on the fallback) and `ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173` (this plan's Task 2 requirement) to `apps/backend/.env`.
- **Files modified:** `apps/backend/.env` (gitignored, not committed)
- **Verification:** All 16 tests pass; CORS test confirms `ALLOWED_ORIGINS` is read correctly.
- **Committed in:** N/A (gitignored file, not committed)

---

**Total deviations:** 1 auto-fixed (1 blocking — environment setup gap carried over from a gitignored file across worktrees)
**Impact on plan:** No scope creep — same values already documented as defaults/requirements in prior plans and this plan's own `<action>` spec.

## Issues Encountered
- Fresh worktree checkout had no `node_modules`, no generated Prisma client, and an incomplete `.env` — resolved with `pnpm install`, `npx prisma generate`, and `.env` additions as described above (same precedent as 01-01/01-02).
- Port 4000 was occupied by an unrelated already-running process in this shared dev environment, so the manual server-boot smoke check used `PORT=4099` instead. This does not affect any automated test (none of the vitest suites bind a real network port — `auth.cors.test.ts` uses `supertest(app)` in-process).

## User Setup Required

None - no external service configuration required. Same `.env` gitignore caveat as 01-01/01-02: any other clone/worktree needs `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL`, and now `ALLOWED_ORIGINS` added manually to `apps/backend/.env`.

## Next Phase Readiness
- `apps/backend/src/app.ts` is ready for every later Phase 1 plan to import via `supertest(app)` for HTTP-level tests (login/refresh/logout endpoints in 01-04+).
- `requireAuth` exists, is fully unit-tested (5/5 passing), and is confirmed unused by any route — ready to be wired in the staged rollout (waves 7-9 per D-08).
- CORS is locked to `ALLOWED_ORIGINS` with `credentials: true` — AUTH-07 satisfied; T-01-06 (CSRF via ambient cookie) mitigation in place ahead of the `SameSite=Strict` refresh-token cookie work in plan 01-04.
- **Important for downstream plans:** any worktree/clone that hasn't yet run plan 01-02 or 01-03 will need `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL`, and `ALLOWED_ORIGINS` manually added to `apps/backend/.env` (all gitignored) — see this SUMMARY and 01-02-SUMMARY.md for exact values/precedent.

---
*Phase: 01-authentication*
*Completed: 2026-09-03*

## Self-Check: PASSED

- FOUND: apps/backend/src/app.ts
- FOUND: apps/backend/src/middleware/auth.ts
- FOUND: apps/backend/tests/middleware.auth.test.ts
- FOUND: apps/backend/tests/auth.cors.test.ts
- FOUND: commit e65493a
- FOUND: commit ce8fd71
- FOUND: commit cd4614a
- FOUND: commit fee70a6
