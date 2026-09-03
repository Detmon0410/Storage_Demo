---
phase: 01-authentication
plan: 05
subsystem: frontend-auth
tags: [react, fetch, jwt, silent-refresh, context-api]

# Dependency graph
requires:
  - phase: 01-authentication (plan 04)
    provides: "Live POST /api/auth/login, /api/auth/refresh, /api/auth/logout endpoints"
provides:
  - "client.ts: request() sends credentials: include, attaches Authorization header from in-memory token, invokes unauthorizedHandler on 401"
  - "AuthContext.tsx: AuthProvider + useAuth() — accessToken/user held in React state, silent refresh on mount, login()/logout()"
affects: [01-authentication (plan 06: login page + route guard will consume AuthProvider/useAuth)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level setter functions (setAccessToken/setUnauthorizedHandler) let a plain fetch-wrapper module react to React state changes without importing React"
    - "Mount-time silent refresh calls fetch() directly (not request()) to avoid the 401-handler firing a spurious 'unauthorized' event on the expected first-load 401-when-not-logged-in case"

key-files:
  created:
    - apps/frontend/src/auth/AuthContext.tsx
  modified:
    - apps/frontend/src/api/client.ts

key-decisions:
  - "Followed the plan's interface spec verbatim — no deviations needed since 01-04's actual endpoint contract matched what this plan expected (login returns { accessToken, user }, refresh returns { accessToken } only, logout is 204)."

requirements-completed: [AUTH-03]

# Metrics
duration: ~15min
completed: 2026-09-03
---

# Phase 1 Plan 05: Frontend Auth Data Layer (client.ts + AuthContext) Summary

**client.ts now sends credentials on every request and attaches an in-memory access token via Authorization header; new AuthContext.tsx silently reacquires that token on app load using the httpOnly refresh cookie, with no token ever touching localStorage/sessionStorage.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-09-03T07:15:29Z
- **Tasks:** 2/2
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- `client.ts` `request()` now sends `credentials: "include"` on every fetch call (so the httpOnly refresh cookie round-trips) and attaches `Authorization: Bearer <token>` only when an in-memory token is set
- `client.ts` exposes `setAccessToken(token)` and `setUnauthorizedHandler(handler)` module-level hooks for `AuthContext` to register into
- Any 401 response from `request()` now invokes the registered `unauthorizedHandler` before throwing `ApiError`, so `AuthContext` can clear its session state reactively
- `createResourceApi`'s exported shape and all existing resource-page behavior is unchanged — no existing page needed modification
- New `apps/frontend/src/auth/AuthContext.tsx` exports `AuthProvider` and `useAuth()`; on mount it calls `POST /api/auth/refresh` directly via `fetch` (bypassing `request()`'s 401 hook, since a first-load "not logged in yet" 401 is expected, not an error condition)
- `login(username, password)` and `logout()` both use `credentials: "include"`; `login` sets both the access token and returned `user` object, `logout` clears session state after calling the backend endpoint (best-effort — network failure still clears local state)
- No access or refresh token is ever written to `localStorage`/`sessionStorage` anywhere in either file (grep-confirmed)

## Task Commits

Each task was committed atomically:

1. **Task 1: add credentials, Authorization header injection, 401 hook to client.ts** - `a348a24` (feat)
2. **Task 2: add AuthContext with silent refresh, login(), logout()** - `d419e1a` (feat)

## Files Created/Modified
- `apps/frontend/src/api/client.ts` - Added `credentials: "include"` to every `request()` fetch call, `Authorization` header injection from `currentAccessToken`, `setAccessToken`/`setUnauthorizedHandler` exports, 401 hook invocation
- `apps/frontend/src/auth/AuthContext.tsx` (new) - `AuthProvider` (mount-time silent refresh, `login()`, `logout()`, registers `client.ts` hooks) and `useAuth()` hook

## Decisions Made
- No new environment setup was required for this worktree beyond `pnpm install` (frontend-only plan; `apps/frontend/.env.development` with `VITE_API_BASE_URL=/api` already existed and needed no changes).
- Confirmed via `git stash`/re-run of `tsc -b --noEmit` before making any changes that 3 pre-existing type errors in `apps/frontend/src/i18n/locales/ja.ts` (unrelated i18next pluralization key mismatches) exist independent of this plan's work — logged to `deferred-items.md`, not fixed (out of scope per the plan's `<files>` list and the scope-boundary rule).

## Deviations from Plan

None - plan executed exactly as written. The interface contract this plan expected from 01-04 (`login` returns `{ accessToken, user }` + sets cookie; `refresh` returns `{ accessToken }` only; `logout` is 204) matched the actual 01-04 implementation exactly, so no adjustments were needed.

## Issues Encountered
- None blocking. Pre-existing `tsc` errors in `ja.ts` (see Decisions Made above) were the only anomaly encountered and are documented in `.planning/phases/01-authentication/deferred-items.md` for a future i18n-focused pass; they do not affect this plan's `<verify>` requirement since neither modified file introduces or touches those locale keys.

## User Setup Required

None - no external service configuration required. This plan only modifies frontend TypeScript files; no new env vars or secrets introduced.

## Next Phase Readiness
- `AuthProvider`/`useAuth()` and the updated `client.ts` are ready for plan 01-06 (login page UI + route guard) to consume directly.
- Documented limitation for 01-06: `/api/auth/refresh` returns only `{ accessToken }` (no user identity), so a page-refresh-driven silent refresh cannot repopulate a non-null `user` object from that call alone. If the route guard needs a definite "authenticated" signal, it should treat "has a valid `accessToken`" as sufficient rather than requiring `user !== null`. Flagged per this plan's own inline note in `AuthContext.tsx`.
- All 10 pre-existing business routes on the backend remain unauthenticated (staged rollout unaffected by this plan — it only touches frontend files).

## Threat Flags

None - all new surface (in-memory token storage, Authorization header injection, credentials-included fetches) was explicitly covered by this plan's `<threat_model>` (T-01-13, T-01-14); no undocumented trust-boundary surface introduced.

---
*Phase: 01-authentication*
*Completed: 2026-09-03*

## Self-Check: PASSED

- FOUND: apps/frontend/src/api/client.ts
- FOUND: apps/frontend/src/auth/AuthContext.tsx
- FOUND: commit a348a24
- FOUND: commit d419e1a
