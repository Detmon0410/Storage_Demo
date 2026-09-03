---
phase: 01-authentication
reviewed: 2026-09-03T00:00:00Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - apps/backend/prisma/schema.prisma
  - apps/backend/prisma/seed.ts
  - apps/backend/src/lib/jwt.ts
  - apps/backend/src/models/refreshToken.model.ts
  - apps/backend/src/models/user.model.ts
  - apps/backend/src/middleware/auth.ts
  - apps/backend/src/app.ts
  - apps/backend/src/index.ts
  - apps/backend/src/controllers/auth.controller.ts
  - apps/backend/src/routes/auth.routes.ts
  - apps/backend/src/middleware/rateLimiter.ts
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
  - apps/frontend/src/auth/AuthContext.tsx
  - apps/frontend/src/auth/RequireAuth.tsx
  - apps/frontend/src/api/client.ts
  - apps/frontend/src/pages/LoginPage.tsx
  - apps/frontend/src/components/layout/Topbar.tsx
  - apps/frontend/src/App.tsx
  - apps/frontend/src/components/ui/Field.tsx
findings:
  critical: 1
  warning: 2
  info: 3
  total: 6
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-09-03
**Depth:** standard
**Files Reviewed:** 22 (backend files listed individually; the 11 route files reviewed for auth wiring only, per scope)
**Status:** issues_found

## Summary

Reviewed the full Phase 1 authentication implementation: Prisma schema/seed, JWT signing/verification, refresh-token and user models, `requireAuth` middleware, the `app.ts`/`index.ts` split, CORS allow-list, login/refresh/logout controller + routes, the login rate limiter, and the frontend auth data layer (`client.ts`, `AuthContext`, `RequireAuth`, `LoginPage`, `Topbar`).

The staged rollout across plans 01-07/08/09 was verified directly against all 11 route files: every route now has `requireAuth` applied to every `.get()`, `.post()`, `.put()`, and `.delete()` call, including the non-generic `customerLicenseRoutes.post("/:id/renew", ...)` write action. No route was accidentally left unauthenticated after the staged rollout.

JWT verification correctly pins `algorithms: ["HS256"]` on both sign and verify (no algorithm-confusion risk). Login uses a fixed dummy Argon2id hash to keep the unknown-username and wrong-password code paths timing/shape-equivalent (no user-enumeration signal). Refresh tokens are stored only as SHA-256 hashes, never in plaintext, and the refresh cookie is `HttpOnly`, `SameSite=Strict`, and path-scoped to `/api/auth`. CORS is a fail-closed explicit allow-list (`ALLOWED_ORIGINS` defaults to an empty array, which `cors` treats as deny-all) with `credentials: true` — never `origin: "*"` or `origin: true`.

One critical issue was found: `JWT_SECRET` falls back to a hardcoded, publicly-known default string embedded directly in `apps/backend/src/lib/jwt.ts` if the environment variable is unset. Because this same file is the single source of truth for both signing and verifying access tokens, an operator who forgets to set `JWT_SECRET` in a real deployment would be running with a secret anyone can read from this repository's source — enabling full authentication bypass via forged tokens. Two warnings and three lower-severity/accepted-risk items are also documented below.

## Critical Issues

### CR-01: JWT_SECRET falls back to a hardcoded, publicly-known default

**File:** `apps/backend/src/lib/jwt.ts:3`
**Issue:** `JWT_SECRET` is read from the environment with a fallback to a literal string committed to source control:
```ts
const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-change-me-in-production-please-32chars-min";
```
This value is used to both sign (`signAccessToken`) and verify (`verifyAccessToken`) every access token, and `requireAuth` (`apps/backend/src/middleware/auth.ts`) trusts any token that verifies against it. If `JWT_SECRET` is not set in a given deployment's environment (a plausible operator error — several Phase 1 SUMMARY.md files note that `.env` is gitignored and had to be manually recreated in every new worktree during this phase), the application silently falls back to this known-public value. Anyone with read access to this repository (i.e., anyone) can then mint a valid `Authorization: Bearer <token>` for any `userId` and bypass `requireAuth` on all 11 fully-enforced business route files, without ever touching `/api/auth/login`.
**Fix:** Fail fast instead of silently falling back to a guessable secret in any environment that isn't explicitly local/dev:
```ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production");
  }
  console.warn("JWT_SECRET not set — using an insecure dev-only default. Do not use this in production.");
}
const SIGNING_SECRET = JWT_SECRET ?? "dev-only-change-me-in-production-please-32chars-min";
```
At minimum, throw/exit on boot when `NODE_ENV === "production"` and `JWT_SECRET` is unset, rather than degrading silently to a value anyone can read in this file.

## Warnings

### WR-01: Default admin password logged in plaintext on seed

**File:** `apps/backend/prisma/seed.ts:503`
**Issue:** When bootstrapping the default System Admin user, the seed script logs the plaintext password to stdout:
```ts
console.log(`Seeded default System Admin user "${adminUsername}" (password: ${adminPassword} — change in production via ADMIN_DEFAULT_PASSWORD env var)`);
```
In any environment where `db:seed` output is captured (CI logs, deployment logs, shared terminal history), this leaks the admin credential in plaintext, including in scenarios where `ADMIN_DEFAULT_PASSWORD` was deliberately set to a real production value.
**Fix:** Only print the plaintext password when using the insecure default, and never when a custom value was supplied:
```ts
if (!process.env.ADMIN_DEFAULT_PASSWORD) {
  console.log(`Seeded default System Admin user "${adminUsername}" with the default dev password — set ADMIN_DEFAULT_PASSWORD before running in any shared/production environment.`);
} else {
  console.log(`Seeded default System Admin user "${adminUsername}" (password taken from ADMIN_DEFAULT_PASSWORD).`);
}
```

### WR-02: Refresh does not re-check user status — deactivated users keep silently renewing access

**File:** `apps/backend/src/controllers/auth.controller.ts:48-55`
**Issue:** `POST /api/auth/refresh` mints a new access token from any valid, non-revoked, non-expired refresh cookie, without re-querying `UserModel`/checking `user.status`:
```ts
export const refresh = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE_NAME];
  if (!raw) throw new HttpError(401, "Not authenticated");
  const record = await RefreshTokenModel.findValid(raw);
  if (!record) throw new HttpError(401, "Session expired");
  const accessToken = signAccessToken({ userId: record.userId });
  res.json({ accessToken });
});
```
`login` does correctly reject `INACTIVE` users, but a user deactivated *after* they already have a valid refresh-token cookie can continue silently refreshing a working session for up to 7 days (the fixed refresh-token TTL) with no server-side revocation check against current account status. This is documented in the 01-04-SUMMARY.md as an accepted gap (T-01-11) deferred to Phase 2 pending a deactivation UI, so it is not a regression, but it is a real gap worth surfacing explicitly in review: there is currently no way to immediately terminate a deactivated user's active session server-side.
**Fix:** When a deactivation feature ships, have `refresh` re-check `UserModel.findById(record.userId)?.status === "ACTIVE"` before issuing a new access token, and/or bulk-revoke a user's `RefreshToken` rows on deactivation.

## Info

### IN-01: No refresh-token rotation

**File:** `apps/backend/src/controllers/auth.controller.ts:10, 48-55`
**Issue:** `REFRESH_TTL_MS` is a fixed 7-day expiry and the same opaque refresh token is reused on every `/api/auth/refresh` call — there is no rotation (issuing a new refresh token and revoking the old one on each use). This is explicitly called out in the code comment and 01-04-SUMMARY.md as "Claude's discretion per CONTEXT.md," so it is an accepted design choice rather than an oversight, but it does mean a stolen refresh-token cookie remains valid and undetectable (no "reuse of an already-rotated token" signal) for its full 7-day lifetime.
**Fix:** Consider rotation-on-use (issue+persist a new token, revoke the old one, detect reuse of a revoked token as a signal to revoke the whole family) in a future hardening pass, as already flagged in the phase's own next-steps notes.

### IN-02: Topbar shows a generic "U" placeholder after a page refresh until next login

**File:** `apps/frontend/src/components/layout/Topbar.tsx:38-40`, `apps/frontend/src/auth/AuthContext.tsx:47-51`
**Issue:** `AuthContext`'s silent-refresh path intentionally sets `user: null` (documented — `/api/auth/refresh` has no user-identity payload to repopulate it), and `Topbar` falls back to a generic `"U"` avatar / `t("app.user")` label whenever `user` is null:
```tsx
{(user?.username ?? "U").slice(0, 1).toUpperCase()}
...
{user?.username ?? t("app.user")}
```
Practically, this means after every browser refresh, the authenticated username disappears from the Topbar (showing a generic placeholder instead) until the user logs out and back in — a minor but user-visible regression from what a reviewer might expect, given AUTH-03 (session persists across refresh) is otherwise satisfied.
**Fix:** Have `/api/auth/refresh` optionally include a minimal `{ user: { id, username } }` in its response (mirroring `login`'s response shape) so `AuthContext` can repopulate `user` on silent refresh, restoring the Topbar's username display across page reloads.

### IN-03: `refreshToken` cookie's `secure` flag depends entirely on `NODE_ENV`

**File:** `apps/backend/src/controllers/auth.controller.ts:12-18`
**Issue:** `secure: process.env.NODE_ENV === "production"` means the refresh cookie will be sent over plain HTTP in any deployment where `NODE_ENV` isn't explicitly set to the literal string `"production"` (e.g., a staging environment left at the Node default or an unset value) — undermining `HttpOnly`/`SameSite=Strict` protections' complement of transport confidentiality.
**Fix:** Not a change needed for local dev, but worth a deployment-checklist note: verify `NODE_ENV=production` is set in every non-local deployment target, or key `secure` off a dedicated `COOKIE_SECURE`/`HTTPS`-aware env var instead of overloading `NODE_ENV`.

---

_Reviewed: 2026-09-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
