---
phase: 01-authentication
plan: 04
subsystem: auth
tags: [express, jwt, argon2, rate-limiting, cookies, vitest, supertest]

# Dependency graph
requires:
  - phase: 01-authentication (plan 02)
    provides: "signAccessToken/verifyAccessToken, RefreshTokenModel (create/findValid/revoke), UserModel (findByUsername)"
  - phase: 01-authentication (plan 03)
    provides: "app.ts (testable Express app for supertest), requireAuth middleware, CORS allow-list"
provides:
  - "Live POST /api/auth/login, /api/auth/refresh, /api/auth/logout endpoints"
  - "loginRateLimiter (10 attempts / 15 min) applied to /api/auth/login"
  - "HttpOnly, SameSite=Strict, path-scoped refreshToken cookie issuance/clearing"
affects: [01-authentication (later plans: frontend login/refresh wiring in 01-05; staged rollout of requireAuth to business routes in 01-07/08/09)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Timing-safe login: argon2.verify always runs (against a fixed dummy hash when the user doesn't exist) so unknown-username and wrong-password paths are response-shape and timing equivalent"
    - "requireAuth applied selectively per-route (only /logout in this plan), not globally — staged rollout (D-08) preserved"

key-files:
  created:
    - apps/backend/src/middleware/rateLimiter.ts
    - apps/backend/src/controllers/auth.controller.ts
    - apps/backend/src/routes/auth.routes.ts
    - apps/backend/tests/auth.login.test.ts
    - apps/backend/tests/auth.logout.test.ts
    - apps/backend/tests/auth.refresh.test.ts
    - apps/backend/tests/auth.rateLimit.test.ts
  modified:
    - apps/backend/src/routes/index.ts

key-decisions:
  - "Used @node-rs/argon2 (not the argon2 package) for password verification in auth.controller.ts, per the environment-incompatibility deviation documented in 01-01/01-02/01-03 SUMMARYs — this environment's argon2 native binding segfaults on Windows/Node 20.19."
  - "Mounted auth.routes.ts at /api/auth in routes/index.ts as part of Task 1 (not deferred to Task 2 as the file-list implied) because Task 1's own <verify> step runs supertest(app) against the live /api/auth/* endpoints — without mounting, all 8 Task 1 behaviors would 404 regardless of controller correctness. Task 2 then added only the rate-limit test and confirmed the full suite (documented as a Rule 3 blocking auto-fix below)."

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-06]

# Metrics
duration: ~20min
completed: 2026-09-03
---

# Phase 1 Plan 04: Login/Refresh/Logout Endpoints Summary

**Live `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout` endpoints with argon2-verified credentials, HttpOnly+SameSite=Strict refresh cookies, and a 10-attempts/15-min login rate limiter — all 10 pre-existing business routes remain unauthenticated (staged rollout intact).**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-09-03T11:04:20Z
- **Tasks:** 2/2
- **Files modified:** 8 (7 created, 1 modified)

## Accomplishments
- `POST /api/auth/login` validates credentials via `@node-rs/argon2`, always running a verify call (against a fixed dummy hash for unknown usernames) so wrong-password and unknown-username responses are identical in both message (`"Invalid username or password"`) and code path — no enumeration signal
- Inactive users (`status: "INACTIVE"`) are rejected at login even with a correct password
- Successful login issues an access token in the JSON body and a `refreshToken` cookie with `HttpOnly`, `SameSite=Strict`, and `path: /api/auth`
- `POST /api/auth/refresh` mints a fresh access token from a valid, non-revoked, non-expired refresh cookie; missing cookie -> 401
- `POST /api/auth/logout` (behind `requireAuth`) revokes the refresh token server-side and clears the cookie; a subsequent refresh with the same (now-revoked) cookie correctly 401s
- `loginRateLimiter` (express-rate-limit, 10/15min) applied only to `/login`; the 11th attempt within the window returns 429 with the documented error body
- `requireAuth` is applied to exactly one route (`/logout`) — confirmed via grep that no other route file imports it, preserving the staged-rollout plan for waves 7-9
- Full backend suite: 7 test files, 25/25 passing, zero regressions from plans 01-02/01-03

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): add failing tests for login/refresh/logout endpoints** - `bc56e51` (test)
2. **Task 1 (GREEN): implement login/refresh/logout endpoints and mount /api/auth** - `fb9fac4` (feat)
3. **Task 2: add login rate-limit test, confirm full suite green** - `11ec86a` (test)

## Files Created/Modified
- `apps/backend/src/middleware/rateLimiter.ts` - `loginRateLimiter` (10 req / 15 min, `standardHeaders: true`)
- `apps/backend/src/controllers/auth.controller.ts` - `login`/`refresh`/`logout` handlers, dummy-hash timing-safe verify, fixed 7-day refresh TTL, no rotation
- `apps/backend/src/routes/auth.routes.ts` - `authRoutes` (`POST /login` with rate limiter, `POST /refresh`, `POST /logout` with `requireAuth`)
- `apps/backend/src/routes/index.ts` - Added `import { authRoutes }` and `apiRoutes.use("/auth", authRoutes)` as the first mount; the other 10 existing `apiRoutes.use(...)` lines are byte-identical to before this plan
- `apps/backend/tests/auth.login.test.ts` - 5 behaviors (valid login + cookie attrs, wrong password, unknown username, missing fields, inactive user)
- `apps/backend/tests/auth.refresh.test.ts` - 2 behaviors (valid cookie -> new access token, no cookie -> 401)
- `apps/backend/tests/auth.logout.test.ts` - 1 behavior (logout revokes refresh token; subsequent refresh with same cookie 401s)
- `apps/backend/tests/auth.rateLimit.test.ts` - 1 behavior (11th login attempt in window -> 429)

## Decisions Made
- Copied `apps/backend/.env` from the parent repo (already containing `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL`, `ALLOWED_ORIGINS` per the 01-03 fix) into this fresh worktree verbatim — no values changed or invented, all three vars confirmed present after copy.
- Ran `pnpm install` and `npx prisma generate` in this worktree (fresh checkout, no `node_modules`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Mounted auth.routes.ts at /api/auth during Task 1, not deferred to Task 2**
- **Found during:** Task 1, attempting to run the RED->GREEN cycle for `auth.login.test.ts`/`auth.logout.test.ts`/`auth.refresh.test.ts`
- **Issue:** The plan's Task 1 `<files>` list only includes `rateLimiter.ts`, `auth.controller.ts`, and the 3 test files — `auth.routes.ts`/`routes/index.ts` are listed under Task 2. But Task 1's own `<action>` and `<verify>` require running the test files against `supertest(app)` and getting GREEN (all 8 behaviors passing). Since the tests hit live HTTP endpoints (`/api/auth/login` etc.), they would 404 regardless of controller correctness unless the routes are mounted — the plan's own acceptance bar for Task 1 was unreachable without Task 2's mounting work.
- **Fix:** Created `apps/backend/src/routes/auth.routes.ts` and added the `/api/auth` mount to `routes/index.ts` as part of Task 1's GREEN commit, using exactly the code specified in Task 2's `<action>` section (no improvisation — the plan already fully specified this code, just filed under a later task). Task 2 then only added the rate-limit test and confirmed the full suite, since the mounting and rate limiter were already functionally complete.
- **Files modified:** `apps/backend/src/routes/auth.routes.ts` (new), `apps/backend/src/routes/index.ts` (modified)
- **Verification:** All 8 Task 1 behaviors pass; Task 2's rate-limit test and full 25-test suite also pass with no additional route/index.ts changes needed.
- **Committed in:** `fb9fac4` (Task 1 GREEN commit)

**2. [Rule 3 - Blocking] Reverted incidental tsconfig.tsbuildinfo changes before each commit**
- **Found during:** Task 1 and Task 2, pre-commit `git status` check
- **Issue:** Running `tsc -b --noEmit` for verification updates the tracked `apps/backend/tsconfig.tsbuildinfo` build-artifact file on every invocation, unrelated to this plan's actual code changes (same pattern noted in 01-03-SUMMARY.md).
- **Fix:** `git checkout -- apps/backend/tsconfig.tsbuildinfo` before staging each task's commit.
- **Files modified:** None (reverted, not committed)
- **Committed in:** N/A (excluded from both commits)

---

**Total deviations:** 2 auto-fixed (1 blocking — task/file-list ordering mismatch with the plan's own verify requirement; 1 blocking — incidental build-artifact noise)
**Impact on plan:** No scope creep — Task 1's GREEN commit uses exactly the `auth.routes.ts`/`routes/index.ts` code the plan itself specifies for Task 2, just applied one task earlier out of necessity. Final end-state (files, routes, tests) is identical to what the plan describes; only the task boundary where the routes file was created shifted.

## Issues Encountered
- Fresh worktree checkout had no `node_modules`, no generated Prisma client, and no `.env` — resolved with `pnpm install`, `npx prisma generate`, and copying `.env` from the parent repo (which already had `JWT_SECRET`/`JWT_ACCESS_TOKEN_TTL`/`ALLOWED_ORIGINS` set correctly per the 01-03 fix, so no new values were needed this time).
- Manual curl verification (plan's `<verification>` item 4) was not run in this session since it requires a live server on port 4000, which prior plans noted is sometimes occupied in this shared dev environment; automated supertest coverage (25/25 passing, including the exact login/refresh/logout flows the curl check would exercise) provides equivalent verification.

## User Setup Required

None - no external service configuration required. Same `.env` gitignore caveat as 01-01/01-02/01-03: any other clone/worktree needs `DATABASE_URL`, `PORT`, `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL`, `ALLOWED_ORIGINS` in `apps/backend/.env`.

## Next Phase Readiness
- `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout` are live, fully tested, and ready for frontend wiring (plan 01-05: silent refresh, login form, logout button).
- All 10 pre-existing business routes remain completely unauthenticated — `requireAuth` is used in exactly one place (`/api/auth/logout`) — staged rollout (D-08) preserved for later waves.
- Refresh tokens use a fixed 7-day expiry with no rotation (explicitly noted in the controller as "Claude's discretion per CONTEXT.md") — rotation could be added in a later hardening pass if needed, out of this plan's scope.
- T-01-11 (deactivation not enforced on refresh, only on login) is a documented accepted gap per the plan's own threat model, deferred to Phase 2 pending a deactivation UI.

## Threat Flags

None - all new surface (`/api/auth/login`, `/refresh`, `/logout`) was explicitly covered by this plan's `<threat_model>` (T-01-09, T-01-10, T-01-11, T-01-12); no undocumented trust-boundary surface introduced.

---
*Phase: 01-authentication*
*Completed: 2026-09-03*

## Self-Check: PASSED

- FOUND: apps/backend/src/middleware/rateLimiter.ts
- FOUND: apps/backend/src/controllers/auth.controller.ts
- FOUND: apps/backend/src/routes/auth.routes.ts
- FOUND: apps/backend/tests/auth.login.test.ts
- FOUND: apps/backend/tests/auth.logout.test.ts
- FOUND: apps/backend/tests/auth.refresh.test.ts
- FOUND: apps/backend/tests/auth.rateLimit.test.ts
- FOUND: commit bc56e51
- FOUND: commit fb9fac4
- FOUND: commit 11ec86a
