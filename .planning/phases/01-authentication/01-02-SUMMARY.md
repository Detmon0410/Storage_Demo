---
phase: 01-authentication
plan: 02
subsystem: auth
tags: [jwt, jsonwebtoken, vitest, argon2, prisma, testing]

# Dependency graph
requires:
  - phase: 01-authentication (plan 01)
    provides: "User/RefreshToken Prisma models pushed to live dev MySQL, backend auth/test dependencies installed, idempotent admin seed"
provides:
  - "vitest test infrastructure (config, DB-safe setup/cleanup helper, test-user fixture) usable by every later plan in this phase"
  - "signAccessToken/verifyAccessToken (HS256-pinned JWT helpers)"
  - "RefreshTokenModel: create/findValid/revoke with SHA-256-hashed-at-rest opaque tokens"
  - "UserModel: findByUsername/findById/create with lowercase username normalization"
affects: [01-authentication (later plans: login/refresh/logout endpoints, auth middleware, controller tests)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tests run against the live dev MySQL DB, scoped to test_-prefixed usernames only; cleanupTestUsers() in afterAll never touches seeded/business data"
    - "vitest.config.ts uses passWithNoTests: true so infra-only commits (zero test files) still exit 0"
    - "Plain object literal models (UserModel, RefreshTokenModel) matching existing CategoryModel convention, prisma singleton import"

key-files:
  created:
    - apps/backend/vitest.config.ts
    - apps/backend/tests/setup.ts
    - apps/backend/tests/fixtures/testUser.ts
    - apps/backend/tests/auth.hashing.test.ts
    - apps/backend/src/lib/jwt.ts
    - apps/backend/src/models/refreshToken.model.ts
    - apps/backend/src/models/user.model.ts
  modified:
    - apps/backend/.env (gitignored — added JWT_SECRET, JWT_ACCESS_TOKEN_TTL)

key-decisions:
  - "Added passWithNoTests: true to vitest.config.ts (Rule 3 auto-fix) — vitest's default behavior exits 1 with zero test files, which contradicted the plan's own Task 1 done criteria (\"executes with zero test files and exits 0\")."
  - "Cast JWT_ACCESS_TOKEN_TTL to jwt.SignOptions[\"expiresIn\"] in jwt.ts (Rule 1 auto-fix) — @types/jsonwebtoken's expiresIn type is a branded StringValue/number union, not a plain string, and strict TS (tsc -b) rejected the plan's literal code as written."
  - "Used @node-rs/argon2 (not argon2) in tests/fixtures/testUser.ts and the test file, per the 01-01 plan's documented environment-incompatibility deviation."

patterns-established:
  - "TDD auth building blocks: RED test file committed before implementation, GREEN implementation committed separately, both referencing the same 8-behavior spec"

requirements-completed: [AUTH-05]

# Metrics
duration: ~35min
completed: 2026-09-03
---

# Phase 1 Plan 02: JWT/Refresh-Token/User Model Foundation (TDD) Summary

**HS256-pinned JWT sign/verify, SHA-256-hashed-at-rest opaque refresh tokens, and lowercase-normalized username lookups — all built test-first against a live-DB-safe vitest harness.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-03T10:44:00Z
- **Completed:** 2026-09-03T10:51:55Z
- **Tasks:** 2/2
- **Files modified:** 8 (7 created, 1 gitignored .env addition)

## Accomplishments
- vitest test infrastructure stood up from zero: config, a live-dev-DB-safe cleanup helper scoped to `test_`-prefixed usernames, and a reusable test-user fixture
- `jwt.ts` signs/verifies access tokens with `algorithms: ["HS256"]` pinned explicitly on both sign and verify (prevents algorithm-confusion attacks)
- `refreshToken.model.ts` never persists the raw opaque token — only its SHA-256 hash — with full create/findValid/revoke lifecycle
- `user.model.ts` normalizes usernames to lowercase on both write and read paths for case-insensitive-safe lookup
- All 8 TDD behaviors specified in the plan pass (RED confirmed failing before implementation, GREEN confirmed passing after)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 — vitest test infrastructure, DB cleanup helper, test-user fixture** - `1d5d8f2` (feat)
2. **Task 2 (RED): add failing test for jwt/refreshToken/user auth building blocks** - `22d036d` (test)
3. **Task 2 (GREEN): implement jwt signing/verification, refresh-token, and user models** - `5e9ac55` (feat)

## Files Created/Modified
- `apps/backend/vitest.config.ts` - Node test environment, `setupFiles: ["./tests/setup.ts"]`, `passWithNoTests: true`
- `apps/backend/tests/setup.ts` - Shared prisma client export + `cleanupTestUsers()` scoped to `username: { startsWith: "test_" }`
- `apps/backend/tests/fixtures/testUser.ts` - `createTestUser(suffix, password?)` fixture, always `test_`-prefixed
- `apps/backend/tests/auth.hashing.test.ts` - 8-behavior test suite (jwt sign/verify/tamper/expiry, refresh-token hash/findValid/revoke, username case-insensitivity, password hash never plaintext)
- `apps/backend/src/lib/jwt.ts` - `signAccessToken`/`verifyAccessToken`, HS256-pinned
- `apps/backend/src/models/refreshToken.model.ts` - `RefreshTokenModel` (create/findValid/revoke) + `generateOpaqueToken`, SHA-256 hashed storage
- `apps/backend/src/models/user.model.ts` - `UserModel` (findByUsername/findById/create), lowercase-normalized
- `apps/backend/.env` (gitignored, not committed) - Added `JWT_SECRET` and `JWT_ACCESS_TOKEN_TTL`

## Decisions Made
- Copied `apps/backend/.env` from the parent repo working tree into this fresh worktree (gitignored, same as 01-01's precedent) so `JWT_SECRET`/`DATABASE_URL` were available for tests; no values invented, content matches plan's documented `<interfaces>` plus the plan's own Task 1 additions.
- Ran `pnpm install` and `pnpm exec prisma generate` in this worktree since it started with no `node_modules` — required before any test/typecheck could run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added `passWithNoTests: true` to vitest.config.ts**
- **Found during:** Task 1 verification
- **Issue:** The plan's own Task 1 `<done>` criteria states `pnpm --filter backend exec vitest run` must execute with zero test files and exit 0. Vitest's actual default behavior is to exit 1 ("No test files found, exiting with code 1") — the plan's literal config as written did not satisfy its own acceptance bar.
- **Fix:** Added `passWithNoTests: true` to the `test` block in `vitest.config.ts`.
- **Files modified:** `apps/backend/vitest.config.ts`
- **Verification:** `pnpm exec vitest run` with zero test files now exits 0.
- **Committed in:** `1d5d8f2` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed TypeScript type error in jwt.ts's `expiresIn` option**
- **Found during:** Task 2, post-GREEN typecheck (`tsc -b --noEmit`)
- **Issue:** The plan's literal `jwt.sign(payload, JWT_SECRET, { algorithm: "HS256", expiresIn: JWT_ACCESS_TOKEN_TTL })` failed strict compilation — `@types/jsonwebtoken`'s `SignOptions.expiresIn` is typed as `number | StringValue`, not a general `string`, so `JWT_ACCESS_TOKEN_TTL` (typed `string` from `process.env.X ?? "15m"`) didn't satisfy any overload.
- **Fix:** Built a typed `options: jwt.SignOptions` object with `expiresIn: JWT_ACCESS_TOKEN_TTL as jwt.SignOptions["expiresIn"]` and passed that to `jwt.sign`. No runtime behavior change — same value, same signature call.
- **Files modified:** `apps/backend/src/lib/jwt.ts`
- **Verification:** `pnpm exec tsc -b --noEmit` exits 0; test suite re-run confirms still 8/8 passing after the fix.
- **Committed in:** `5e9ac55` (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking test-infra gap, 1 type-correctness bug)
**Impact on plan:** Both fixes necessary to meet the plan's own stated acceptance criteria and pass strict typecheck. No scope creep — no new files, no architectural change.

## Issues Encountered
- This worktree started with no `node_modules` (fresh checkout) and no `apps/backend/.env` (gitignored) — resolved by running `pnpm install`, `pnpm exec prisma generate`, and copying `.env` from the parent repo working tree, matching the precedent set in 01-01-SUMMARY.md.

## User Setup Required

None - no external service configuration required. Same `.env` gitignore caveat as 01-01: any other clone/worktree needs this file created manually (see `apps/backend/.env` requirements documented in 01-01/01-02 SUMMARYs).

## Next Phase Readiness
- `jwt.ts`, `refreshToken.model.ts`, `user.model.ts` are implemented, unit-tested (8/8), and follow this codebase's existing model/lib conventions (plain object literal, `prisma` singleton import).
- vitest test infrastructure (`vitest.config.ts`, `tests/setup.ts`, `tests/fixtures/testUser.ts`) is reusable by every later Phase 1 plan (login/refresh/logout controllers, auth middleware).
- **Important for downstream plans:** continue using `import * as argon2 from "@node-rs/argon2"` (not the `argon2` package) for any password hashing/verification code, per the 01-01 deviation.

---
*Phase: 01-authentication*
*Completed: 2026-09-03*

## Self-Check: PASSED

- FOUND: apps/backend/vitest.config.ts
- FOUND: apps/backend/tests/setup.ts
- FOUND: apps/backend/tests/fixtures/testUser.ts
- FOUND: apps/backend/tests/auth.hashing.test.ts
- FOUND: apps/backend/src/lib/jwt.ts
- FOUND: apps/backend/src/models/refreshToken.model.ts
- FOUND: apps/backend/src/models/user.model.ts
- FOUND: commit 1d5d8f2
- FOUND: commit 22d036d
- FOUND: commit 5e9ac55
