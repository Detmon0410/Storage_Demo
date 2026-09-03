# Phase 1: Authentication - Research

**Researched:** 2026-09-03
**Domain:** Custom username/password authentication (JWT access token + DB-backed opaque refresh token) retrofitted onto an existing unauthenticated Express 4.21 / Prisma 6.4.1 / MySQL backend and React 19 / Vite frontend, with zero prior auth.
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Token & Session Architecture**
- D-01: Short-lived JWT access token (10-15 min), stored in-memory on the frontend (React state/context) — never localStorage.
- D-02: Opaque refresh token stored in an `httpOnly`, `Secure`, `SameSite=Strict` cookie, persisted server-side in a `sessions`/`refresh_tokens` Prisma table (not a plain stateless JWT) so it can be revoked on logout.
- D-03: Password hashing via `argon2` (Argon2id, native binding) — not bcrypt.
- D-04: On browser refresh, frontend silently re-acquires an access token using the refresh-token cookie (no re-login prompt) — this is how "session persists across browser refresh" (AUTH-03) is satisfied despite in-memory access-token storage.

**First-Admin Bootstrap**
- D-05: Extend the existing `apps/backend/prisma/seed.ts` to create one default System Admin user, following the project's existing `db:setup`/`db:seed` pattern. No setup wizard, no manual DB step.

**Login Identifier & Password Rules**
- D-06: Login identifier is **username** (not email) — internal tool, no email verification/deliverability infrastructure needed or in scope.
- D-07: Password rule is minimum length only (8+ characters). No forced complexity rules.

**Frontend Rollout Strategy**
- D-08: Staged rollout, not a big-bang cutover: (1) issue tokens/build login endpoint, (2) wire frontend API client to attach access token, (3) enforce auth on read endpoints, (4) enforce on write endpoints, (5) enforce on destructive actions.

**Bundled Hardening (in this phase, not deferred)**
- D-09: Fix CORS: restrict to the known frontend origin(s) instead of the current allow-all `cors()` config — done in this same phase.
- D-10: Add `express-rate-limit` on the login endpoint (AUTH-06).

### Claude's Discretion
- Exact JWT/access-token lifetime within the 10-15 min research recommendation.
- Exact refresh-token lifetime and rotation policy (e.g., rotate-on-use vs fixed expiry).
- Whether the `sessions` table also tracks IP/user-agent (useful for audit logging in Phase 2, but not required by this phase's own success criteria).

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope. RBAC/permissions and audit logging were mentioned only as downstream consumers of this phase's identity work, not as scope additions here (they are already their own Phase 2).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User can log in with username/email and password | Login endpoint pattern, `argon2.verify()`, User model shape — see Standard Stack, Code Examples |
| AUTH-02 | User can log out, invalidating their session/refresh token | Refresh-token DB table with revocation, logout endpoint clears row + cookie — see Architecture Patterns, Code Examples |
| AUTH-03 | User session persists across browser refresh via short-lived access token + refresh token | Silent-refresh flow (`/auth/refresh` using httpOnly cookie), frontend `AuthProvider` bootstrap-on-mount pattern — see Architecture Patterns |
| AUTH-04 | All existing API routes require a valid authenticated session (no anonymous access) | Staged rollout plan (D-08), `requireAuth` middleware, per-route-file wiring across all 10 existing route files — see Don't Hand-Roll, Common Pitfalls (Pitfall 1) |
| AUTH-05 | Passwords are stored hashed (never plaintext), using a modern hashing algorithm | `argon2` Argon2id native binding, User model `passwordHash` field, never log raw password — see Standard Stack, Common Pitfalls |
| AUTH-06 | Login attempts are rate-limited to resist brute-force attacks | `express-rate-limit` on `/auth/login`, scoped by IP + username — see Standard Stack, Code Examples |
| AUTH-07 | CORS is restricted to known frontend origin(s) instead of allowing all origins | `cors()` origin allow-list + `credentials: true` (required for cookie-based refresh token) — see Common Pitfalls (Pitfall 2), Code Examples |
</phase_requirements>

## Summary

This phase adds a from-scratch custom auth subsystem to a codebase that has run with **zero authentication for its entire history** — every one of the 10 existing route files (`categories`, `suppliers`, `products`, `stock-transactions`, `import-orders`, `licenses`, `customers`, `customer-licenses`, `sales-orders`, `inventory-stocks`) plus `dashboard-kpis` is currently open. There is no `User` model in `schema.prisma` yet — this phase must create it. The architecture is: `argon2` (Argon2id, native binding) for password hashing, a short-lived (10-15 min) `jsonwebtoken`-signed JWT access token held in-memory on the frontend (React context, never localStorage), and an opaque random refresh token persisted in a new `RefreshToken`/`Session` Prisma table, delivered via an `httpOnly`, `Secure`, `SameSite=Strict` cookie so it survives browser refresh and can be revoked server-side on logout. `cookie-parser` is required to read that cookie. `express-rate-limit` throttles `/api/auth/login`, and the existing wide-open `cors()` call in `apps/backend/src/index.ts` must be replaced with an origin allow-list plus `credentials: true` (required once cookies carry auth state cross-origin between the Vite dev server and the Express API).

The highest-risk failure mode for this specific phase is **not** picking the wrong library — the stack choice is well-established and already pre-researched in `.planning/research/STACK.md` — it's the **rollout sequencing**. Because every route is currently open and the frontend has zero token-handling code, wrapping all routes in `requireAuth` in one commit will 401 the entire application instantly, including the existing seed-driven demo data flows. The user's own D-08 decision and the project's own PITFALLS.md both mandate the same staged order: issue tokens → wire frontend client → enforce reads → enforce writes → enforce destructive actions. This maps directly onto discrete, independently-testable plan waves.

**Primary recommendation:** Build the User/RefreshToken schema and `argon2`/`jsonwebtoken`/`cookie-parser`/`express-rate-limit` backend plumbing first (Wave 1), wire the frontend `AuthProvider` + `client.ts` header injection + login page second (Wave 2), then flip on `requireAuth` globally in `routes/index.ts` last (Wave 3) — never as a single combined change. Extend `prisma/seed.ts` to create the default System Admin (D-05) in the same wave the User model is created, so `db:setup` never regresses.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Password hashing/verification | API / Backend | — | Never sent to client; `argon2` runs server-side only in the login/register flow |
| Access token issuance & verification | API / Backend | — | JWT signed/verified with a server-only secret (`JWT_SECRET` env var) |
| Access token storage | Browser / Client | — | In-memory only (React context/state), per D-01 — never persisted (no localStorage, no cookie for the access token itself) |
| Refresh token issuance, storage, revocation | API / Backend | Database / Storage | Opaque token generated server-side, persisted in `RefreshToken` Prisma table so `DELETE`/expire = revoke; delivered to client only via httpOnly cookie |
| Refresh token transport | Browser / Client | — | Browser auto-attaches the httpOnly cookie on same-origin/`credentials:'include'` requests; JS on the page cannot read or exfiltrate it |
| Session persistence across refresh | Browser / Client | API / Backend | Frontend `AuthProvider` calls `/api/auth/refresh` on mount (cookie sent automatically) to silently reacquire an access token; backend validates the opaque refresh token against the DB |
| Auth enforcement (401) on API routes | API / Backend | — | `requireAuth` middleware; must never be enforced only in the UI (core project value statement) |
| CORS origin restriction | API / Backend | — | `cors()` middleware config in `apps/backend/src/index.ts`; browser cannot be trusted to self-restrict |
| Login rate limiting | API / Backend | — | `express-rate-limit` keyed by IP (and optionally by submitted username) on `/api/auth/login` only |
| Login form / logout button UI | Browser / Client | — | Standard React form; no business logic, just calls the auth API |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `argon2` | 0.45.1 | Password hashing (Argon2id) | OWASP's current primary recommendation for new password-storage systems; memory-hard, resists GPU/ASIC cracking. `[VERIFIED: npm registry, 2026-09-03]` |
| `jsonwebtoken` | 9.0.3 | Sign/verify short-lived access tokens | Mature, zero-dependency-risk, matches "custom auth, no third-party IdP" constraint in PROJECT.md. `[VERIFIED: npm registry, 2026-09-03]` |
| `@types/jsonwebtoken` | 9.0.10 | TS types for `jsonwebtoken` | `[VERIFIED: npm registry, 2026-09-03]` |
| `cookie-parser` | 1.4.7 | Parse the httpOnly refresh-token cookie | Required companion to Express when the refresh token travels via cookie rather than a header. `[VERIFIED: npm registry, 2026-09-03]` |
| `@types/cookie-parser` | 1.4.10 | TS types for `cookie-parser` | `[VERIFIED: npm registry, 2026-09-03]` |
| `express-rate-limit` | 8.7.0 | Throttle `/api/auth/login` (AUTH-06) | Standard, near-zero-integration-cost Express rate limiter; already flagged as a pre-existing gap in `.planning/codebase/CONCERNS.md`. `[VERIFIED: npm registry, 2026-09-03]` |
| Node built-in `crypto.randomBytes` / `crypto.randomUUID()` | Node 20+ built-in | Generate the opaque refresh token value | No extra dependency needed. `[VERIFIED: Node 20 built-in, training knowledge]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cors` | 2.8.6 (already installed as `^2.8.5`) | CORS origin allow-list (AUTH-07) | Already a dependency — this phase reconfigures its usage (adds `origin` allow-list + `credentials: true`), does not add a new package. `[VERIFIED: npm registry, 2026-09-03 — current version 2.8.6, project pins ^2.8.5 which resolves to 2.8.6]` |
| `zod` | 4.5.4 | Validate login request body (`username`, `password`) | Optional but recommended per `.planning/research/STACK.md` — the login endpoint is new untrusted-input surface; scope validation to just the new auth routes if a full app-wide rollout is out of phase scope. `[CITED: .planning/research/STACK.md]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `argon2` | `bcrypt`/`bcryptjs` | Acceptable fallback, but no legacy bcrypt data exists to migrate — no reason to pick the second-best OWASP option for a greenfield table |
| JWT access token + DB refresh token | `express-session` + MemoryStore/`express-mysql-session` | Not chosen because it duplicates what a `RefreshToken` Prisma table already gives more cleanly, and doesn't fit the SPA-over-CORS shape as naturally |
| Hand-rolled JWT via `jsonwebtoken` | Third-party IdP (Auth0/Supabase/Clerk) | Explicitly out of scope per REQUIREMENTS.md "Out of Scope" table — external dependency/vendor lock-in inconsistent with existing codebase pattern |

**Installation:**
```bash
cd apps/backend
pnpm add argon2 jsonwebtoken cookie-parser express-rate-limit
pnpm add -D @types/jsonwebtoken @types/cookie-parser
# zod optional, scoped to auth routes if full rollout is out of scope
pnpm add zod
```

**Version verification:** Confirmed live against npm registry 2026-09-03 (same day as this research): `argon2@0.45.1`, `jsonwebtoken@9.0.3`, `cookie-parser@1.4.7`, `express-rate-limit@8.7.0`, `cors@2.8.6`, `@types/jsonwebtoken@9.0.10`, `@types/cookie-parser@1.4.10`. No frontend package additions are required — access-token-in-memory storage uses React 19's existing Context API, already the app's pattern (no Redux).

## Architecture Patterns

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│ BROWSER (React 19 SPA)                                              │
│  AuthProvider (React Context: accessToken in-memory, user, loading) │
│    on mount → POST /api/auth/refresh (cookie auto-sent)             │
│      ├─ 200 → set accessToken in memory, render app                 │
│      └─ 401 → clear state, render <LoginPage/>                      │
│  LoginPage → POST /api/auth/login {username,password}               │
│  client.ts request() → attaches "Authorization: Bearer <token>"     │
│    from AuthContext to every /api/* call                            │
│  On any 401 response → AuthProvider clears token, redirects /login  │
└───────────────────────────┬───────────────────────────────────────┘
                             │ fetch(..., { credentials: "include" })
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│ EXPRESS (apps/backend/src/index.ts)                                 │
│  cors({ origin: ALLOWED_ORIGINS, credentials: true })                │
│  express.json() → cookieParser()                                    │
│  /api/auth/login  → rateLimiter → authController.login              │
│  /api/auth/refresh→ authController.refresh (reads httpOnly cookie)  │
│  /api/auth/logout → requireAuth → authController.logout             │
│  /api  (all other routers) → requireAuth (added per Wave 3) → ...   │
└───────────────────────────┬───────────────────────────────────────┘
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│ CONTROLLER / MODEL LAYER                                            │
│  authController.login:                                              │
│    UserModel.findByUsername → argon2.verify(hash, password)         │
│    → signAccessToken({userId}) (10-15min)                           │
│    → RefreshTokenModel.create (opaque random value, DB row, expiry) │
│    → res.cookie("refreshToken", opaque, {httpOnly,Secure,SameSite}) │
│  authController.refresh:                                            │
│    RefreshTokenModel.findValid(cookieValue) → 401 if missing/expired│
│    → signAccessToken({userId}) → return { accessToken }             │
│  authController.logout:                                             │
│    RefreshTokenModel.revoke(cookieValue) → clearCookie              │
│  middleware/auth.ts requireAuth:                                    │
│    verify Bearer JWT → attach req.userId → next() / HttpError(401)  │
└───────────────────────────┬───────────────────────────────────────┘
                             ▼
┌────────────────────────────────────────────────────────────────────┐
│ PRISMA / MYSQL                                                      │
│  User { id, username (unique), passwordHash, status, createdAt }    │
│  RefreshToken { id, tokenHash, userId, expiresAt, revokedAt,        │
│                 createdAt }  ← store a HASH of the opaque token,    │
│                 not the raw value, so a DB leak doesn't leak usable │
│                 refresh tokens                                      │
└────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
apps/backend/src/
├── middleware/
│   ├── auth.ts              # requireAuth() — verifies Bearer JWT, attaches req.userId
│   ├── rateLimiter.ts        # loginRateLimiter (express-rate-limit instance)
│   └── errorHandler.ts       # existing — no change needed, HttpError already covers 401/403
├── lib/
│   ├── jwt.ts                 # signAccessToken(), verifyAccessToken() — reads JWT_SECRET, expiry config
│   └── refreshToken.ts        # generateOpaqueToken(), hashToken() (sha256 for at-rest storage)
├── models/
│   ├── user.model.ts          # new — findByUsername(), create(), verifyPassword()
│   └── refreshToken.model.ts  # new — create(), findValid(), revoke(), revokeAllForUser()
├── controllers/
│   └── auth.controller.ts     # new — login, refresh, logout, (optional) me
├── routes/
│   ├── auth.routes.ts         # new — mounted BEFORE requireAuth is applied globally
│   └── index.ts                # existing — mount authRoutes; apply requireAuth per Wave 3
prisma/
├── schema.prisma               # add User, RefreshToken models
└── seed.ts                     # extend to create default System Admin (D-05)

apps/frontend/src/
├── auth/
│   ├── AuthContext.tsx         # new — React context: accessToken, user, login(), logout(), loading
│   └── RequireAuth.tsx         # new — route guard wrapper, redirects to /login if no user
├── pages/
│   └── LoginPage.tsx           # new — username/password form
├── api/
│   └── client.ts                # existing — extend request() to attach Authorization header + credentials:'include', handle 401
└── App.tsx                     # existing — add /login route + wrap existing routes in <RequireAuth>
```

### Pattern 1: Silent refresh on mount (session survives browser refresh)

**What:** On app load, before rendering protected routes, `AuthProvider` calls `POST /api/auth/refresh` with `credentials: 'include'`. The browser automatically attaches the httpOnly refresh-token cookie (no JS access needed/possible). If valid, the backend returns a fresh short-lived access token; the frontend stores it in memory and renders the app. If invalid/missing, the user is routed to `/login`.
**When to use:** This is the *only* mechanism satisfying AUTH-03 given the D-01 constraint (access token never persisted). Without it, an in-memory-only access token would force re-login on every page refresh, which fails the phase's stated success criterion.
**Example:**
```typescript
// apps/backend/src/controllers/auth.controller.ts
export const refresh = asyncHandler(async (req, res) => {
  const raw = req.cookies?.refreshToken;
  if (!raw) throw new HttpError(401, "Not authenticated");
  const record = await RefreshTokenModel.findValid(raw); // hashes raw, looks up, checks expiresAt/revokedAt
  if (!record) throw new HttpError(401, "Session expired");
  const accessToken = signAccessToken({ userId: record.userId });
  res.json({ accessToken });
});
```
```tsx
// apps/frontend/src/auth/AuthContext.tsx
useEffect(() => {
  fetch(`${BASE_URL}/auth/refresh`, { method: "POST", credentials: "include" })
    .then((r) => (r.ok ? r.json() : Promise.reject()))
    .then(({ accessToken }) => setAccessToken(accessToken))
    .catch(() => setAccessToken(null))
    .finally(() => setLoading(false));
}, []);
```

### Pattern 2: Refresh token revocation on logout (AUTH-02)

**What:** Refresh tokens are opaque random values, hashed (SHA-256) before storage in the `RefreshToken` table — never store the raw value at rest, since a DB read (or backup leak) would otherwise hand out live, directly-usable session tokens. Logout looks up the row by the raw cookie value (hashing it the same way to compare), marks it revoked (or deletes it), and clears the cookie.
**When to use:** Every logout call; also apply the same revoke path on password change (not in this phase's scope, but keep `revokeAllForUser` available for future reuse).
**Example:**
```typescript
// apps/backend/src/models/refreshToken.model.ts
import { createHash, randomBytes } from "crypto";

export function generateOpaqueToken() {
  return randomBytes(32).toString("hex");
}
function hash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export const RefreshTokenModel = {
  async create(userId: number, ttlMs: number) {
    const raw = generateOpaqueToken();
    await prisma.refreshToken.create({
      data: { tokenHash: hash(raw), userId, expiresAt: new Date(Date.now() + ttlMs) },
    });
    return raw; // only the raw value is ever sent to the client, as the cookie value
  },
  async findValid(raw: string) {
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(raw) } });
    if (!record || record.revokedAt || record.expiresAt < new Date()) return null;
    return record;
  },
  async revoke(raw: string) {
    await prisma.refreshToken.updateMany({ where: { tokenHash: hash(raw) }, data: { revokedAt: new Date() } });
  },
};
```

### Pattern 3: Staged auth-enforcement rollout (matches D-08)

**What:** `requireAuth` is written once but wired in progressively: Wave 1 ships login/refresh/logout with no enforcement anywhere (existing routes stay open); Wave 2 wires the frontend client to attach tokens and adds a login page + route guard; Wave 3 applies `requireAuth` to `routes/index.ts` globally (this single line change enforces AUTH-04 across all 10 existing route files at once, since they're all mounted under one `apiRoutes` router) — but only after Wave 2's frontend has shipped, so the app doesn't 401 itself.
**When to use:** Mandatory for this phase — both `.planning/research/PITFALLS.md` (Pitfall 1) and the user's own D-08 decision require this exact sequencing, not an atomic switch.
**Example:**
```typescript
// apps/backend/src/routes/index.ts — Wave 3 change (single point of enforcement)
import { requireAuth } from "../middleware/auth.js";
export const apiRoutes = Router();
apiRoutes.use("/auth", authRoutes); // login/refresh must stay OUTSIDE requireAuth
apiRoutes.use(requireAuth); // everything registered below this line requires a valid session
apiRoutes.use("/categories", categoryRoutes);
apiRoutes.use("/suppliers", supplierRoutes);
// ... remaining 8 routers unchanged, now all covered by the one requireAuth call
```
This is deliberately a **one-line enforcement toggle** at the router-mounting level rather than editing all 10 route files individually — simpler to stage/roll back, and matches the "layer, don't rewrite" principle from PITFALLS.md. (Per-route `requirePermission` fine-graining is Phase 2/RBAC's job, not this phase's.)

### Anti-Patterns to Avoid
- **Storing the raw refresh token value in the database:** A DB compromise or backup leak would hand out live sessions. Store a SHA-256 hash of the opaque token instead; compare by hashing the incoming cookie value.
- **Storing the access token (or refresh token) in `localStorage`:** XSS-accessible — any injected script can exfiltrate every session. This is explicitly forbidden by D-01/D-02 and STACK.md.
- **Embedding anything beyond `userId` + `exp` in the JWT payload:** No roles/permissions in this phase's tokens — Phase 2 (RBAC) re-derives permissions from the DB per request specifically to avoid the "stale JWT after role change" problem; keep this phase's JWT payload minimal so Phase 2 doesn't have to fight legacy token shape.
- **Wrapping all 10 route files in `requireAuth` in the same commit as the login endpoint:** Causes an instant full-app outage (every existing page 401s with no login UI yet to recover). Follow the staged rollout (Pattern 3 / D-08).
- **CORS `origin: true` / reflecting the request origin:** Functionally equivalent to allow-all when combined with `credentials: true` — must be an explicit allow-list of known frontend origin(s) from an env var, not a wildcard or reflect-any-origin.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing/verification | Custom PBKDF2/SHA loop | `argon2.hash()` / `argon2.verify()` | Parameter tuning (memory cost, iterations, parallelism) for resisting GPU cracking is a solved, security-critical problem — hand-rolling risks weak defaults |
| JWT signing/verification, expiry handling | Custom base64+HMAC token format | `jsonwebtoken` | Correct constant-time signature comparison, standard `exp`/`iat` claim handling, and algorithm-confusion-attack prevention (always pin `algorithms: ["HS256"]` on verify) are easy to get subtly wrong by hand |
| Rate limiting | Custom in-memory counter + timestamp map | `express-rate-limit` | Handles sliding windows, per-key (IP) buckets, and standard `RateLimit-*` response headers correctly; a hand-rolled counter is trivial to get wrong under concurrent requests |
| Secure random token generation | `Math.random()`-based ID | Node `crypto.randomBytes(32)` | `Math.random()` is not cryptographically secure — predictable refresh tokens defeat the entire revocation model |
| Cookie parsing/serialization (httpOnly/Secure/SameSite flags) | Manual `Set-Cookie` header string building | `cookie-parser` + Express's `res.cookie()` | Cookie attribute syntax (especially `SameSite`, encoding, `Max-Age` vs `Expires`) has enough edge cases that a hand-rolled string is a common source of subtly-broken cookies across browsers |

**Key insight:** Every piece of this phase that touches cryptography or security-sensitive parsing (hashing, signing, random generation, rate limiting) has a mature, actively-maintained library already selected in `.planning/research/STACK.md`. The only genuinely custom code in this phase is the *thin glue* connecting them (the User/RefreshToken Prisma models, the `requireAuth` middleware, and the staged rollout sequencing) — that glue is exactly what plan tasks should focus effort on, not re-deriving cryptographic primitives.

## Common Pitfalls

### Pitfall 1: Big-bang auth cutover breaks every existing CRUD flow at once
**What goes wrong:** Wrapping all routes with `requireAuth` in the same change as building login causes the entire frontend to 401 immediately — no login UI exists yet to recover, and the existing `useResource` hook's error handling means failures can render as "data just doesn't load" rather than a clear message.
**Why it happens:** The system was built with zero auth for its whole history; there's no existing pattern to extend incrementally, so "add auth" is tempting to treat as one commit.
**How to avoid:** Follow the exact staged order from D-08 / Architecture Pattern 3: (1) issue tokens without enforcement, (2) wire frontend client + login page, (3) enforce 401 globally via the single `apiRoutes.use(requireAuth)` line, placed after the login/refresh routes.
**Warning signs:** Any plan task that adds `requireAuth` to a route file in the same wave as building the login endpoint, before frontend token-attachment work exists.
`[CITED: .planning/research/PITFALLS.md Pitfall 1]`

### Pitfall 2: CORS fixed with `credentials: true` but no explicit origin allow-list (or vice versa)
**What goes wrong:** Once the refresh token travels in a cookie, cross-origin requests from the Vite dev server (a different port than the Express API in dev) must include `credentials: 'include'` on the fetch **and** the backend must respond with `Access-Control-Allow-Credentials: true` **and** a specific `Access-Control-Allow-Origin` (never `*` — the CORS spec disallows wildcard origin when credentials are involved, and browsers will silently reject the response). Missing either half breaks the cookie flow with a confusing browser-console-only error, not a clean 401.
**Why it happens:** `cors()` with no options (the app's current config) works fine for credential-less requests but silently breaks the instant cookies are introduced; teams fixing "CORS is wide open" as a standalone security task can miss that `credentials: true` is now *required*, not optional, once refresh-token cookies exist.
**How to avoid:** Configure `cors({ origin: ALLOWED_ORIGINS.split(','), credentials: true })` reading from an env var (e.g., `ALLOWED_ORIGINS`), and ensure the frontend's `fetch`/`client.ts` calls include `credentials: 'include'` on every request that needs the cookie (at minimum `/auth/refresh`, `/auth/logout`; safe to set on all requests). Test explicitly against the actual dev-server origin, not just `curl` (curl doesn't enforce CORS, so a working `curl` test can hide a broken browser flow).
**Warning signs:** Login/refresh works via curl/Postman but silently fails only in the browser with a generic network error and a CORS message in devtools console.
`[VERIFIED: CORS spec — wildcard origin + credentials is disallowed by browsers, training knowledge cross-checked against MDN CORS documentation]`

### Pitfall 3: Deactivated/deleted users still authenticate via a still-valid access token or refresh token
**What goes wrong:** RBAC (Phase 2) will add user deactivation, but this phase's own success criteria imply a `User.status` concept should exist so a compromised account can be locked out. If the JWT is trusted purely on signature validity without a per-request DB check, a revoked user's *access token* remains usable until its (short) natural expiry — usually acceptable given the 10-15 min TTL — but if the *refresh token* isn't also revoked/checked against `User.status`, the account can silently keep refreshing indefinitely after being "deactivated."
**Why it happens:** It's easy to treat "revoke session" as only meaning "delete the refresh token used at logout time" and forget that a full account deactivation (an admin-initiated action, out of this phase's scope but the schema groundwork happens here) needs `RefreshToken.findValid()` (or `refresh`) to also check the user is still active, not just that the token row itself is unexpired/unrevoked.
**How to avoid:** Add a `status` field to the `User` model now (even if only `ACTIVE`/`INACTIVE` with no admin UI to change it yet — Phase 2/RBAC adds that UI), and have `authController.refresh` check `user.status === 'ACTIVE'` in addition to the refresh-token validity check. This avoids a schema migration surprise in Phase 2.
**How to avoid (login):** Also enforce `status === 'ACTIVE'` in the login flow itself, not just refresh.
**Warning signs:** No `status` field on the seeded `User` model; `refresh`/`login` controllers only query `RefreshToken`/verify password without joining back to check user account state.
`[ASSUMED: based on general auth best-practice knowledge — not explicitly required by this phase's AUTH-01..07 acceptance criteria, but strongly recommended to avoid Phase 2 rework]`

### Pitfall 4: Rate limiter keyed only by IP misses distributed/credential-stuffing attempts, or blocks shared-office IPs entirely
**What goes wrong:** A pure per-IP rate limit either (a) is too loose against an attacker rotating IPs, or (b) is too strict for legitimate users behind a shared corporate/office NAT (relevant here — this is an internal B2B tool where multiple employees likely share one office IP), locking out real users after a few mistyped passwords from different people.
**Why it happens:** `express-rate-limit`'s default keying is IP-only; teams apply the default without considering the "internal tool, shared office network" deployment context.
**How to avoid:** For this project's context (single/few known offices, internal tool — not public internet-facing signup), a reasonably generous per-IP window (e.g., 10 attempts / 15 min) combined with an account-level lockout/backoff signal (e.g., track failed attempts per username in the login flow, not just via the rate-limit middleware) gives better protection without locking out a whole office. At minimum, ship the IP-based `express-rate-limit` (satisfies AUTH-06 literally) and flag account-level throttling as a possible follow-up if it's not explicitly required by the phase's success criteria.
**Warning signs:** Rate limit window/max chosen without considering that this is an internal multi-user-per-office tool, not a consumer-facing signup form.
`[ASSUMED: deployment-context reasoning, not verified against a specific office-network topology for this project]`

### Pitfall 5: Prisma `User.username` uniqueness constraint case-sensitivity mismatch with login lookup
**What goes wrong:** MySQL's default collation for `VARCHAR` columns is typically case-insensitive (`utf8mb4_general_ci`/`utf8mb4_0900_ai_ci`), so `@unique` on `username` may already behave case-insensitively at the DB level — but if the login controller does an exact-match Prisma `findUnique({ where: { username } })` without normalizing case first (e.g., lowercasing on both write and read), inconsistent casing at signup vs. login usually still "works" due to MySQL's default collation, but this should not be *assumed* without checking the actual configured collation for this specific database.
**Why it happens:** Case-sensitivity behavior is collation-dependent, not universal, and differs between MySQL versions/configurations.
**How to avoid:** Normalize `username` to lowercase before both `create` and lookup queries (defensive, collation-independent), regardless of what the DB collation happens to do. Simple, cheap, removes the ambiguity entirely.
**Warning signs:** Login fails for `Admin` when the account was created as `admin`, or two accounts get silently created with usernames differing only by case.
`[ASSUMED: MySQL default collation behavior — not verified against this project's actual configured DB collation in this research pass; verify `SHOW TABLE STATUS` collation before finalizing, or just apply the defensive lowercase normalization regardless]`

## Code Examples

### Login endpoint (AUTH-01, AUTH-05, AUTH-06)
```typescript
// apps/backend/src/controllers/auth.controller.ts
import argon2 from "argon2";
import { asyncHandler } from "../utils/asyncHandler.js";
import { HttpError } from "../middleware/errorHandler.js";
import { UserModel } from "../models/user.model.js";
import { RefreshTokenModel } from "../models/refreshToken.model.js";
import { signAccessToken } from "../lib/jwt.js";

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — Claude's discretion per CONTEXT.md

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) throw new HttpError(400, "Username and password required");

  const user = await UserModel.findByUsername(username.toLowerCase());
  // Constant-shape response whether user exists or not — don't leak "user not found" vs "bad password"
  const valid = user ? await argon2.verify(user.passwordHash, password) : false;
  if (!user || !valid || user.status !== "ACTIVE") {
    throw new HttpError(401, "Invalid username or password");
  }

  const accessToken = signAccessToken({ userId: user.id });
  const refreshToken = await RefreshTokenModel.create(user.id, REFRESH_TTL_MS);

  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: true, // requires HTTPS in production; set false only for local HTTP dev if unavoidable
    sameSite: "strict",
    maxAge: REFRESH_TTL_MS,
    path: "/api/auth", // scope the cookie to auth endpoints only
  });

  res.json({ accessToken, user: { id: user.id, username: user.username } });
});
```

### `requireAuth` middleware (AUTH-04)
```typescript
// apps/backend/src/middleware/auth.ts
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./errorHandler.js";
import { verifyAccessToken } from "../lib/jwt.js";

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return next(new HttpError(401, "Not authenticated"));
  try {
    const payload = verifyAccessToken(token); // throws on invalid/expired
    (req as Request & { userId: number }).userId = payload.userId;
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired session"));
  }
}
```

### CORS + rate limiter wiring (AUTH-06, AUTH-07)
```typescript
// apps/backend/src/index.ts (Wave 1 changes)
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" },
});
// applied only to the login route, e.g. in auth.routes.ts:
// router.post("/login", loginRateLimiter, login);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| bcrypt as default password hash | Argon2id as OWASP-recommended default for new systems | OWASP Password Storage Cheat Sheet (multi-year guidance, reaffirmed through 2025-2026) | Greenfield auth tables should start on Argon2id directly rather than bcrypt-then-migrate |
| Storing JWT (access or refresh) in `localStorage` | httpOnly cookie for anything long-lived/revocable; in-memory only for short-lived access tokens | Long-standing OWASP guidance, reaffirmed across 2025-2026 Node auth guides | Removes the single largest XSS-driven session-theft vector for this app |
| Roles/permissions embedded in JWT payload | JWT carries only identity (`userId`); permissions re-derived from DB per request | Consistently recommended across 2025-2026 RBAC/Node auth sources | Directly relevant even though RBAC is Phase 2 — keep this phase's JWT payload minimal now to avoid a breaking token-shape change later |

**Deprecated/outdated:**
- `express-session` + in-memory `MemoryStore` for production auth: not chosen here — leaks memory, doesn't scale past one process, and a Prisma-backed `RefreshToken` table already gives equivalent (better) revocability for this JWT+refresh architecture.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A per-user `status` field (ACTIVE/INACTIVE) should be added to the `User` model in this phase, even though deactivation UI is Phase 2 scope | Common Pitfalls (Pitfall 3) | Low — if omitted now, Phase 2 needs an additive migration instead; not a breaking risk, just extra Phase 2 work. Recommend confirming with user during planning if this is considered in/out of Phase 1 schema scope. |
| A2 | IP-only `express-rate-limit` (10/15min) is sufficient for AUTH-06 given this is an internal multi-office tool | Common Pitfalls (Pitfall 4) | Medium — if the real deployment has many users behind one shared office IP, the chosen window/max could lock out legitimate users; needs confirmation of actual expected concurrent-login-failure volume per office, or just tune conservatively and revisit if reported |
| A3 | MySQL collation for `username` may already be case-insensitive by default, but defensive lowercasing is recommended regardless | Common Pitfalls (Pitfall 5) | Low — defensive normalization is applied either way, so this assumption doesn't block correct behavior, only explains *why* it's being applied |
| A4 | Refresh token TTL of 7 days and access token TTL of ~12 minutes are reasonable defaults within the user's specified ranges/discretion | Code Examples, D-01/Claude's Discretion | Low — explicitly flagged as Claude's discretion in CONTEXT.md; planner/user can adjust without any architectural rework |

## Open Questions

1. **Should `User.status` (active/inactive) be part of this phase's schema, or deferred entirely to Phase 2/RBAC?**
   - What we know: CONTEXT.md's Claude's Discretion section doesn't explicitly mention it; REQUIREMENTS.md's RBAC-05 ("System Admin can create, edit, deactivate, and reactivate users") is explicitly Phase 2.
   - What's unclear: Whether Phase 1 should ship the `status` column now (schema-only, unused by any UI) to avoid an additive migration later, or whether that's scope creep into Phase 2's territory.
   - Recommendation: Add the column now (cheap, additive, and Pitfall 3 depends on it existing for the refresh/login checks to be meaningful) but do not build any admin UI or deactivation endpoint in this phase — that stays Phase 2.

2. **Exact refresh-token rotation policy (rotate-on-use vs. fixed-expiry-only) — explicitly left to Claude's discretion in CONTEXT.md.**
   - What we know: A fixed-expiry (non-rotating) refresh token is simpler to implement and reason about, and is sufficient to satisfy AUTH-02/AUTH-03 as stated.
   - What's unclear: Whether rotate-on-use (issuing a new refresh token on every `/auth/refresh` call, invalidating the old one) is worth the added complexity for this phase's threat model (internal tool, not public-facing).
   - Recommendation: Ship fixed-expiry (no rotation) for Phase 1 — it fully satisfies the stated success criteria with less surface area for bugs (e.g., race conditions on concurrent refresh calls invalidating each other). Rotation can be added later without breaking the `RefreshToken` schema shape (it's additive, not a redesign).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime for `crypto.randomBytes`, backend server | ✓ (per `.planning/codebase/STACK.md`, Node 20+ required/assumed) | 20+ | — |
| MySQL | `User`/`RefreshToken` Prisma tables | ✓ (existing `DATABASE_URL`-configured DB, per codebase STACK.md) | 5.7+/MariaDB equivalent | — |
| pnpm | Installing new backend dependencies | ✓ (existing monorepo package manager) | 9+ | — |
| argon2 native binding | Password hashing | Not yet installed — install-time native compilation required (prebuilt binaries exist for common platforms via `node-argon2`) | 0.45.1 (to install) | If native binding fails to build on the target deploy platform, `bcrypt` is the documented fallback in STACK.md (also requires native compilation, similar risk) — flag for the executor to verify a clean `pnpm add argon2` + `pnpm build` on the actual deploy target before relying on it |

**Missing dependencies with no fallback:** None — all required packages are standard npm registry packages installable via the existing `pnpm` workspace tooling.

**Missing dependencies with fallback:** `argon2` native binding — if install/build fails on the deployment platform (rare on modern Linux/Windows/macOS with Node 20, but possible on unusual architectures), fall back to `bcrypt` per STACK.md's documented alternative; this would only require swapping the two calls in `user.model.ts`, not a schema change (both produce a string hash storable in the same `passwordHash` column).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None currently installed — `.planning/codebase/CONCERNS.md` confirms zero test tooling in either `apps/backend/package.json` or `apps/frontend/package.json` |
| Config file | none — see Wave 0 |
| Quick run command | `pnpm --filter backend exec vitest run <file>` (once installed) |
| Full suite command | `pnpm --filter backend exec vitest run` (once installed) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Login with correct username/password succeeds, returns access token | unit/integration | `vitest run tests/auth.login.test.ts -t "valid credentials"` | ❌ Wave 0 |
| AUTH-01 | Login with wrong password / unknown username fails with 401, no info leak on which failed | unit/integration | `vitest run tests/auth.login.test.ts -t "invalid credentials"` | ❌ Wave 0 |
| AUTH-02 | Logout revokes the refresh token; subsequent refresh with the same cookie fails | integration | `vitest run tests/auth.logout.test.ts` | ❌ Wave 0 |
| AUTH-03 | `/auth/refresh` with a valid cookie returns a new access token without credentials | integration | `vitest run tests/auth.refresh.test.ts` | ❌ Wave 0 |
| AUTH-04 | An unauthenticated request to any existing route (e.g. `/api/products`) returns 401 | integration | `vitest run tests/auth.enforcement.test.ts` | ❌ Wave 0 |
| AUTH-05 | `passwordHash` in DB is never the plaintext password; login never logs raw password | unit | `vitest run tests/auth.hashing.test.ts` | ❌ Wave 0 |
| AUTH-06 | 11th login attempt within the rate-limit window is rejected (429) | integration | `vitest run tests/auth.rateLimit.test.ts` | ❌ Wave 0 |
| AUTH-07 | Request from a non-allow-listed `Origin` header is rejected by CORS | integration | `vitest run tests/auth.cors.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `vitest run <file>` for the auth test just written/touched
- **Per wave merge:** `pnpm --filter backend exec vitest run` (full backend suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] Install a test framework — `vitest` recommended (lighter than Jest, native ESM/TS support matching this project's `"type": "module"` + `tsx` setup); `pnpm --filter backend add -D vitest supertest @types/supertest`
- [ ] `apps/backend/vitest.config.ts` — basic Node test environment config
- [ ] `apps/backend/tests/setup.ts` — test DB setup/teardown helper (e.g., point `DATABASE_URL` at a test schema, or use Prisma's test-transaction pattern) — this is genuinely new groundwork since zero tests exist anywhere in the repo today
- [ ] `apps/backend/tests/auth.login.test.ts`, `auth.logout.test.ts`, `auth.refresh.test.ts`, `auth.enforcement.test.ts`, `auth.hashing.test.ts`, `auth.rateLimit.test.ts`, `auth.cors.test.ts` — all net-new, covering AUTH-01 through AUTH-07 respectively
- [ ] Seed/test-fixture helper to create a throwaway test user with a known password (do not reuse the D-05 seeded System Admin credentials in automated tests)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | yes | `argon2` (Argon2id) password hashing; JWT access token + opaque DB-backed refresh token; account status check on login/refresh |
| V3 Session Management | yes | httpOnly/Secure/SameSite=Strict refresh-token cookie; server-side revocable session (RefreshToken table); short access-token TTL (10-15 min) |
| V4 Access Control | partial (this phase only) | `requireAuth` (authentication gate) fully in scope; fine-grained permission checks (V4's core concern) are Phase 2/RBAC — this phase only establishes "is there a valid session at all" |
| V5 Input Validation | yes | Login body (`username`, `password`) validated (min-length 8+ per D-07, required fields) — use `zod` per STACK.md recommendation, scoped to the new auth routes at minimum |
| V6 Cryptography | yes | Never hand-roll — `argon2` for hashing (memory-hard, salted internally), Node `crypto.randomBytes` for refresh-token generation, `jsonwebtoken` (HMAC-SHA256, pinned `algorithms` on verify) for access tokens |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credential stuffing / brute force on `/api/auth/login` | Spoofing | `express-rate-limit` per IP (AUTH-06); constant-response-shape on invalid username vs. invalid password (don't leak which one was wrong) |
| Refresh-token theft via XSS reading cookie | Spoofing/Information Disclosure | `httpOnly` flag makes the cookie inaccessible to JS entirely — this is the primary mitigation, not CSP alone |
| CSRF using the ambient refresh-token cookie | Tampering | `SameSite=Strict` on the refresh-token cookie (browser won't attach it on cross-site requests) + CORS origin allow-list (AUTH-07) as defense-in-depth |
| JWT algorithm-confusion attack (attacker sends an `alg: none` or RS256-vs-HS256-swapped token) | Tampering/Spoofing | Pin `algorithms: ['HS256']` explicitly in `jwt.verify()` options — never accept `alg` from the token itself |
| Refresh-token replay after DB leak | Information Disclosure | Store only a SHA-256 hash of the opaque refresh token, never the raw value, so a DB dump alone doesn't yield usable sessions |
| Timing attack distinguishing "user exists" from "wrong password" via response latency | Information Disclosure | `argon2.verify()` against a real stored hash always runs the full hashing cost; when the user doesn't exist, still perform a dummy `argon2.verify()` call (or equivalent constant-time delay) rather than returning immediately, to avoid a measurable timing signal |

## Sources

### Primary (HIGH confidence)
- Live `npm view <pkg> version` registry queries (argon2, jsonwebtoken, cookie-parser, express-rate-limit, cors, @types/jsonwebtoken, @types/cookie-parser) — verified directly against npm registry 2026-09-03, same day as this research
- Direct codebase inspection: `apps/backend/src/index.ts`, `apps/backend/src/middleware/errorHandler.ts`, `apps/backend/src/utils/asyncHandler.ts`, `apps/backend/src/routes/index.ts`, `apps/backend/prisma/schema.prisma`, `apps/backend/prisma/seed.ts`, `apps/backend/package.json`, `apps/frontend/src/api/client.ts`, `apps/frontend/src/hooks/useResource.ts`, `apps/frontend/src/App.tsx`, `apps/frontend/package.json` — confirms zero existing auth code, zero `User` model, wide-open `cors()`, and the exact integration points this phase must touch

### Secondary (MEDIUM confidence, inherited from prior project research)
- `.planning/research/STACK.md` — library selection and "what NOT to use" rationale for this milestone's auth subsystem (dated 2026-09-03, same-day research pass)
- `.planning/research/ARCHITECTURE.md` — middleware-chain pattern, JWT-carries-only-identity anti-pattern guidance
- `.planning/research/PITFALLS.md` — staged-rollout requirement (Pitfall 1), CORS-with-auth warning (Security Mistakes table)
- `.planning/codebase/CONCERNS.md` — confirms unrestricted CORS, missing auth, no rate limiting, zero test coverage as pre-existing gaps this phase must close

### Tertiary (LOW confidence)
- None separately flagged beyond what's captured in the Assumptions Log above — all substantive claims either trace to a verified npm registry check, direct codebase inspection, or the prior same-day project research pass.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every package version independently re-verified live against npm registry in this research pass, matching the prior STACK.md research exactly
- Architecture: HIGH — patterns directly extend the existing, directly-inspected codebase conventions (asyncHandler, HttpError, ResourceModel-style models); no speculative new architectural style introduced
- Pitfalls: MEDIUM-HIGH — codebase-specific pitfalls (staged rollout, CORS, no User model yet) verified by direct file inspection; general security pitfalls (rate-limit keying, collation) partially flagged `[ASSUMED]` where deployment-specific facts (actual office network topology, actual DB collation) weren't independently verified in this pass

**Research date:** 2026-09-03
**Valid until:** 2026-10-03 (30 days — stable ecosystem, no fast-moving dependencies in this stack)
