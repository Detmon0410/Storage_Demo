# Phase 1: Authentication - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-03
**Phase:** 1-authentication
**Areas discussed:** Token/session design, First-admin bootstrap, Login identifier & password rules, Frontend rollout strategy

---

## Token/Session Design

| Option | Description | Selected |
|--------|-------------|----------|
| JWT access + refresh cookie | Short-lived JWT (10-15min) in frontend memory; opaque refresh token in httpOnly/Secure/SameSite=Strict cookie, persisted in a sessions table for revocation | ✓ |
| Simple server session only | express-session style, no JWT — simpler but less scalable, harder to reason about with a separate Vite SPA | |

**User's choice:** JWT access + refresh cookie (Recommended)
**Notes:** Matches research/STACK.md recommendation directly.

| Option | Description | Selected |
|--------|-------------|----------|
| In-memory only | Access token lives in React state/context; silently re-acquired via refresh-token cookie on page load. Immune to XSS token theft. | ✓ |
| localStorage | Simpler to persist across reloads but vulnerable to XSS token theft — not recommended by research | |

**User's choice:** In-memory only (Recommended)

---

## First-Admin Bootstrap

| Option | Description | Selected |
|--------|-------------|----------|
| Seed script | Extend the existing prisma/seed.ts to create one default admin user, matching the project's existing db:setup/db:seed pattern | ✓ |
| One-time setup wizard | First-run UI flow that creates the admin account interactively — more polished, more work | |
| Manual DB insert | Document a manual SQL/Prisma Studio step — no code, but easy to forget/misconfigure | |

**User's choice:** Seed script (Recommended)

---

## Login Identifier & Password Rules

| Option | Description | Selected |
|--------|-------------|----------|
| Username | Simple internal-tool pattern; no email infrastructure needed | ✓ |
| Email | Matches customer-facing convention but implies email deliverability/verification concerns not otherwise in scope | |

**User's choice:** Username (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum length only | e.g. 8+ characters — simple, avoids user friction; hashing algorithm does the heavy lifting | ✓ |
| Length + complexity | Require mixed case/numbers/symbols — more friction, marginal benefit given Argon2id already resists cracking | |

**User's choice:** Minimum length only (Recommended)

---

## Frontend Rollout Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Staged | Issue tokens → wire client → enforce reads → enforce writes → enforce destructive actions | ✓ |
| Big-bang cutover | Flip auth on for all routes at once — simpler as one PR, higher risk | |

**User's choice:** Staged (Recommended)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, include both | Restrict CORS to known frontend origin + add express-rate-limit on login endpoint, in this same phase | ✓ |
| No, defer | Keep this phase to login/logout/session only; handle CORS/rate-limiting separately | |

**User's choice:** Yes, include both (Recommended)

---

## Claude's Discretion

- Exact JWT access-token lifetime within the 10-15 min research recommendation
- Exact refresh-token lifetime and rotation policy
- Whether the sessions table tracks IP/user-agent

## Deferred Ideas

None — discussion stayed within phase scope.
