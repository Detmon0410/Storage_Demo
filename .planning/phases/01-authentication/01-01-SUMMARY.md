---
phase: 01-authentication
plan: 01
subsystem: auth
tags: [prisma, mysql, argon2, jwt-prep, seed, schema]

# Dependency graph
requires: []
provides:
  - "User and RefreshToken Prisma models (plus UserStatus enum) live in the dev MySQL database"
  - "All backend auth + test tooling dependencies installed (jsonwebtoken, zod, cookie-parser, express-rate-limit, argon2-equivalent hashing, vitest, supertest)"
  - "Idempotent default System Admin seed bootstrap (D-05) with Argon2id-hashed password"
affects: [01-authentication (later plans: JWT signing, login/refresh/logout endpoints, auth middleware, tests)]

# Tech tracking
tech-stack:
  added: ["@node-rs/argon2 (napi-rs based Argon2id hashing — substituted for ranisalt/node-argon2 per deviation below)", "jsonwebtoken", "cookie-parser", "express-rate-limit", "zod", "vitest", "supertest"]
  patterns: ["Idempotent seed bootstrap via findUnique-before-create guard, matching how db:setup can be re-run against a non-empty dev DB"]

key-files:
  created: []
  modified: ["apps/backend/package.json", "apps/backend/prisma/schema.prisma", "apps/backend/prisma/seed.ts", "pnpm-lock.yaml"]

key-decisions:
  - "Substituted @node-rs/argon2 for the plan-specified argon2 (ranisalt/node-argon2) package: the prebuilt native binding for argon2@0.45.1 segfaults on require() in this execution environment (Windows/Node 20.19), and no older argon2 version could be built from source here (no Python/MSVC toolchain available). @node-rs/argon2 is invoked via `import * as argon2 from \"@node-rs/argon2\"` so the call-site pattern `argon2.hash(...)` is unchanged, and it still produces $argon2id$ hashes matching the threat model's ASVS V6 requirement."

requirements-completed: [AUTH-05]

# Metrics
duration: ~45min
completed: 2026-09-03
---

# Phase 1 Plan 01: Schema and Dependency Foundation Summary

**User/RefreshToken Prisma models pushed to live dev MySQL, all Phase 1 backend dependencies installed, and an idempotent Argon2id-hashed default System Admin seed bootstrap (D-05).**

## Performance

- **Duration:** ~45 min (includes native-module troubleshooting)
- **Completed:** 2026-09-03T03:43:23Z
- **Tasks:** 2/2
- **Files modified:** 4 (package.json, schema.prisma, seed.ts, pnpm-lock.yaml)

## Accomplishments
- `users` and `refresh_tokens` tables now exist in the live dev MySQL database (`liqior_db`), matching the exact schema from `<interfaces>` (camelCase fields, `@map`/`@@map` to snake_case)
- All 5 backend runtime deps (argon2-equivalent hashing, cookie-parser, express-rate-limit, jsonwebtoken, zod) and 5 dev/test deps (vitest, supertest, + 3 @types packages) installed, plus a `test` script
- `seed.ts` now bootstraps a default `admin` System Admin user with an Argon2id password hash on `db:setup`/`db:seed`, safely re-runnable without duplication

## Task Commits

Each task was committed atomically:

1. **Task 1: Install backend dependencies and add User/RefreshToken schema, push to dev DB** - `75506a2` (feat)
2. **Task 2: Extend seed.ts to bootstrap a default System Admin (D-05)** - `3da9cb2` (feat)

_Note: Task 2's commit also updates package.json/pnpm-lock.yaml to swap the argon2 dependency (see Deviations)._

## Files Created/Modified
- `apps/backend/package.json` - Added auth + test tooling dependencies; `@node-rs/argon2` in place of `argon2` (see deviation)
- `apps/backend/prisma/schema.prisma` - Added `User`, `RefreshToken` models and `UserStatus` enum
- `apps/backend/prisma/seed.ts` - Added idempotent default admin bootstrap using `argon2.hash()` (via `@node-rs/argon2`)
- `pnpm-lock.yaml` - Updated for new dependency tree

## Decisions Made
- Copied `apps/backend/.env` (gitignored, present in the parent repo working tree but absent from this fresh worktree checkout) into the worktree so `prisma db push`/`db:seed` could reach the live dev database — content matches the plan's documented `<interfaces>` `.env` verbatim, no values changed.
- Kept the admin bootstrap block at the very top of `main()`, before the existing `$transaction([...])` deleteMany block, since it has no dependency on the rest of the seed data and must never be wiped by the demo-data reset transaction (which does not touch the `users` table).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Substituted @node-rs/argon2 for argon2 (ranisalt/node-argon2)**
- **Found during:** Task 2 (seed.ts admin bootstrap) — first surfaced when running the verification command
- **Issue:** `argon2@0.45.1`'s prebuilt native binding (`prebuilds/win32-x64/argon2.glibc.node`) causes a hard segmentation fault (SIGSEGV) at `require("argon2")` time in this execution environment (Windows, Node v20.19.0), even after a forced clean reinstall. Downgrading to `argon2@0.31.2` avoids the crash but requires a source build via `node-gyp`, and this environment has no working Python/MSVC toolchain (`cl.exe` not found, `python` resolves to a Windows Store stub), so the native addon cannot be compiled either. A control test confirmed native N-API addon loading works in general here (a different native module, `lightningcss`, loaded and ran successfully), isolating the fault to this specific package's prebuilt binary.
- **Fix:** Installed `@node-rs/argon2` (napi-rs based Argon2id implementation) instead. Verified it loads and hashes correctly (`$argon2id$v=19$...` output). Imported as `import * as argon2 from "@node-rs/argon2"` so the call-site remains `argon2.hash(...)`, preserving the interface contract from `<interfaces>` and the plan's `must_haves.artifacts` pattern match (`argon2\\.hash`). It still satisfies the threat model's T-01-01 mitigation (Argon2id hashing per ASVS V6) — only the underlying native package changed, not the hashing algorithm or security guarantee.
- **Files modified:** `apps/backend/package.json` (dependency swap), `apps/backend/prisma/seed.ts` (import line), `pnpm-lock.yaml`
- **Verification:** `pnpm run db:seed` succeeds; running it twice leaves exactly 1 `admin` row (`SELECT COUNT(*) FROM users WHERE username='admin'` = 1); stored `passwordHash` is a 97-character `$argon2id$...` string, not the plaintext `changeme123`.
- **Committed in:** `3da9cb2` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking — native module environment incompatibility)
**Impact on plan:** Necessary to unblock Task 2 entirely; no scope creep. Later Phase 1 plans (login/refresh endpoints, password verification) that reference `argon2` should use the same `import * as argon2 from "@node-rs/argon2"` pattern for hash/verify calls, since the plain `argon2` package is confirmed non-functional in this environment.

## Issues Encountered
- Fresh worktree checkout did not include `apps/backend/.env` (gitignored, untracked file present only in the parent working tree) — copied it in verbatim to unblock `prisma db push`/`db:seed` against the live dev database. No credentials were changed or invented; content matches the plan's documented `<interfaces>` section.

## User Setup Required

None - no external service configuration required. Note for local dev parity: any other clone/worktree of this repo will similarly need a manually-created `apps/backend/.env` (see `apps/backend/prisma/seed.ts`'s neighboring `.env` requirements) since it is gitignored by design.

## Next Phase Readiness
- `users`/`refresh_tokens` tables and all required backend dependencies are in place; later Phase 1 plans (JWT signing, password verification, login/refresh/logout endpoints, auth middleware, tests) can proceed.
- **Important for downstream plans:** use `import * as argon2 from "@node-rs/argon2"` (not `import argon2 from "argon2"`) for any password hashing/verification code added in later plans of this phase, per the deviation above. The `argon2.hash(...)` / `argon2.verify(...)` call shape is unchanged.

---
*Phase: 01-authentication*
*Completed: 2026-09-03*

## Self-Check: PASSED

- FOUND: apps/backend/package.json
- FOUND: apps/backend/prisma/schema.prisma
- FOUND: apps/backend/prisma/seed.ts
- FOUND: `argon2.hash` pattern in seed.ts
- FOUND: `model User` in schema.prisma
- FOUND: `model RefreshToken` in schema.prisma
- FOUND: commit 75506a2
- FOUND: commit 3da9cb2
