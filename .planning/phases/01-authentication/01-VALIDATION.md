---
phase: 01
slug: authentication
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-03
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (none currently installed — Wave 0 installs) |
| **Config file** | none — Wave 0 creates `apps/backend/vitest.config.ts` |
| **Quick run command** | `pnpm --filter backend exec vitest run <file>` |
| **Full suite command** | `pnpm --filter backend exec vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter backend exec vitest run <file>` (targeted to the auth test just touched)
- **After every plan wave:** Run `pnpm --filter backend exec vitest run` (full backend suite)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-xx | TBD | 0 | AUTH-01 | Credential stuffing / brute force | Valid credentials succeed, return access token | integration | `vitest run tests/auth.login.test.ts -t "valid credentials"` | ❌ W0 | ⬜ pending |
| 01-01-xx | TBD | 0 | AUTH-01 | Information Disclosure (timing/enumeration) | Invalid credentials fail 401, no info leak on which field was wrong | integration | `vitest run tests/auth.login.test.ts -t "invalid credentials"` | ❌ W0 | ⬜ pending |
| 01-01-xx | TBD | — | AUTH-02 | CSRF / refresh-token theft | Logout revokes refresh token; reuse of revoked cookie fails | integration | `vitest run tests/auth.logout.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-xx | TBD | — | AUTH-03 | Refresh-token replay | `/auth/refresh` with valid cookie returns new access token | integration | `vitest run tests/auth.refresh.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-xx | TBD | — | AUTH-04 | Access Control (missing enforcement) | Unauthenticated request to any existing route returns 401 | integration | `vitest run tests/auth.enforcement.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-xx | TBD | — | AUTH-05 | Cryptography (plaintext storage) | `passwordHash` never plaintext; login never logs raw password | unit | `vitest run tests/auth.hashing.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-xx | TBD | — | AUTH-06 | Spoofing (brute force) | 11th login attempt within rate-limit window rejected (429) | integration | `vitest run tests/auth.rateLimit.test.ts` | ❌ W0 | ⬜ pending |
| 01-01-xx | TBD | — | AUTH-07 | CSRF / cross-origin abuse | Request from non-allow-listed Origin rejected by CORS | integration | `vitest run tests/auth.cors.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `pnpm --filter backend add -D vitest supertest @types/supertest` — install test framework (no framework exists anywhere in repo)
- [ ] `apps/backend/vitest.config.ts` — basic Node test environment config
- [ ] `apps/backend/tests/setup.ts` — test DB setup/teardown helper (point `DATABASE_URL` at test schema or use Prisma test-transaction pattern)
- [ ] `apps/backend/tests/auth.login.test.ts`, `auth.logout.test.ts`, `auth.refresh.test.ts`, `auth.enforcement.test.ts`, `auth.hashing.test.ts`, `auth.rateLimit.test.ts`, `auth.cors.test.ts` — stubs for AUTH-01..07
- [ ] Seed/test-fixture helper to create a throwaway test user with known password (do NOT reuse seeded System Admin credentials in automated tests)

---

## Manual-Only Verifications

*None — all phase behaviors have automated verification per the map above.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
