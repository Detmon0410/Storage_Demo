# Phase 1: Authentication - Context

**Gathered:** 2026-09-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Users must log in before accessing the system; no anonymous access to any existing API route. This phase delivers: login/logout, password hashing, short-lived access token + refresh token, session persistence across browser refresh, and backend-wide auth enforcement. It does NOT deliver RBAC/permissions (Phase 2) or audit logging (Phase 2) — those consume the `user` identity this phase establishes, but are out of scope here.

</domain>

<decisions>
## Implementation Decisions

### Token & Session Architecture
- **D-01:** Short-lived JWT access token (10-15 min), stored in-memory on the frontend (React state/context) — never localStorage.
- **D-02:** Opaque refresh token stored in an `httpOnly`, `Secure`, `SameSite=Strict` cookie, persisted server-side in a `sessions`/`refresh_tokens` Prisma table (not a plain stateless JWT) so it can be revoked on logout.
- **D-03:** Password hashing via `argon2` (Argon2id, native binding) — not bcrypt.
- **D-04:** On browser refresh, frontend silently re-acquires an access token using the refresh-token cookie (no re-login prompt) — this is how "session persists across browser refresh" (AUTH-03) is satisfied despite in-memory access-token storage.

### First-Admin Bootstrap
- **D-05:** Extend the existing `apps/backend/prisma/seed.ts` to create one default System Admin user, following the project's existing `db:setup`/`db:seed` pattern. No setup wizard, no manual DB step.

### Login Identifier & Password Rules
- **D-06:** Login identifier is **username** (not email) — internal tool, no email verification/deliverability infrastructure needed or in scope.
- **D-07:** Password rule is minimum length only (8+ characters). No forced complexity (mixed case/numbers/symbols) — Argon2id's resistance to cracking makes complexity rules low-value friction for an internal tool.

### Frontend Rollout Strategy
- **D-08:** Staged rollout, not a big-bang cutover: (1) issue tokens/build login endpoint, (2) wire frontend API client to attach access token, (3) enforce auth on read endpoints, (4) enforce on write endpoints, (5) enforce on destructive actions. Matches PITFALLS.md guidance against an atomic all-at-once change.

### Bundled Hardening (in this phase, not deferred)
- **D-09:** Fix CORS: restrict to the known frontend origin(s) instead of the current allow-all `cors()` config — done in this same phase, not deferred, per PITFALLS.md's warning that "auth without CORS restriction is worse than no auth."
- **D-10:** Add `express-rate-limit` on the login endpoint to blunt brute-force/credential-stuffing attempts (AUTH-06).

### Claude's Discretion
- Exact JWT/access-token lifetime within the 10-15 min research recommendation.
- Exact refresh-token lifetime and rotation policy (e.g., rotate-on-use vs fixed expiry).
- Whether the `sessions` table also tracks IP/user-agent (useful for audit logging in Phase 2, but not required by this phase's own success criteria).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Scope
- `.planning/PROJECT.md` — Core value, constraints (backend-first enforcement, no third-party auth)
- `.planning/REQUIREMENTS.md` §Authentication (AUTH-01..07) — this phase's requirements
- `.planning/ROADMAP.md` §Phase 1 — goal and success criteria

### Research (authoritative for this phase)
- `.planning/research/STACK.md` §Authentication — library choices (argon2, jsonwebtoken, cookie-parser), session/token architecture recommendation, explicit "what NOT to use" guidance
- `.planning/research/ARCHITECTURE.md` — where auth middleware fits in the existing Route→Controller→Model→Prisma layering
- `.planning/research/PITFALLS.md` — staged rollout guidance, CORS-with-auth warning, silent-error-swallowing in `useResource` hook flagged as needing a fix around this phase

### Existing Codebase
- `.planning/codebase/ARCHITECTURE.md` — existing layered pattern (controllers/models/routes), `asyncHandler`, `HttpError` conventions to extend
- `.planning/codebase/STACK.md` — current dependency set (Express 4.21, Prisma 6.4.1)
- `.planning/codebase/CONCERNS.md` — CORS-allow-all and no-rate-limiting flagged as pre-existing gaps, now addressed in D-09/D-10

### Source Docs
- `liquor-system-improvement-advice.md` §6 (Authentication, Roles, And Audit Logs) — original requirement framing
- `liquor-system-basic-role-permission-recommendation.md` — role structure this auth layer must ultimately support (Phase 2 consumes this, but user-table shape decided here should not conflict)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/utils/asyncHandler.ts` — wrap new auth middleware/controllers the same way existing controllers are wrapped
- `apps/backend/src/middleware/errorHandler.ts` — `HttpError` class already provides the 401/403 response pattern to reuse for auth failures
- `apps/backend/prisma/seed.ts` — extend for first-admin bootstrap (D-05) rather than creating a separate bootstrap mechanism
- `apps/frontend/src/api/client.ts` — existing fetch wrapper (`request()`, `ApiError`) is the integration point for attaching the access token to every request

### Established Patterns
- Backend: Route → Controller → Model → Prisma, all mutations wrapped in `prisma.$transaction()` where needed — new auth code should follow this, not introduce a new layering style
- Frontend: no global state store (Redux/etc.) — local + hook state only; access-token-in-memory (D-01) should live in a React context, consistent with this existing pattern

### Integration Points
- `apps/backend/src/index.ts` — mount new auth routes and CORS/rate-limit middleware here (this is where `cors()` is currently configured with no restrictions)
- `apps/frontend/src/App.tsx` — route tree needs a login route + auth guard wrapping the existing page routes
- Every existing route file in `apps/backend/src/routes/` — will need `requireAuth` middleware added per the staged rollout plan (D-08), but the middleware itself is designed once in this phase

</code_context>

<specifics>
## Specific Ideas

No specific UI/UX references given — standard login form (username + password) is acceptable. No "I want it like X" moments from this discussion; decisions above are the concrete specifics.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. RBAC/permissions and audit logging were mentioned only as downstream consumers of this phase's identity work, not as scope additions here (they are already their own Phase 2).

</deferred>

---

*Phase: 01-authentication*
*Context gathered: 2026-09-03*
