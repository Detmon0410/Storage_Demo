---
phase: 01-authentication
plan: 06
subsystem: frontend-auth
tags: [react, react-router, i18next, login-form, route-guard]
status: complete

# Dependency graph
requires:
  - phase: 01-authentication (plan 05)
    provides: "AuthContext.tsx (AuthProvider/useAuth), client.ts credentials+Authorization wiring"
provides:
  - "RequireAuth.tsx: route guard redirecting unauthenticated visitors to /login, gated on accessToken (not user)"
  - "LoginPage.tsx: username/password form wired to useAuth().login()"
  - "App.tsx: AuthProvider + RequireAuth wired around the existing route tree, /login route outside the guard"
  - "Topbar.tsx: logout dropdown entry point"
affects: [01-authentication (plans 07/08/09: backend requireAuth rollout to business routes)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RequireAuth checks accessToken (not user) as the authenticated signal, since /api/auth/refresh does not return user identity on silent refresh — documented limitation from 01-05, resolved here by exposing accessToken from AuthContext"
    - "TextInput wrapped in forwardRef (additive) to support programmatic focus on the password field after a failed login"

key-files:
  created:
    - apps/frontend/src/auth/RequireAuth.tsx
    - apps/frontend/src/pages/LoginPage.tsx
  modified:
    - apps/frontend/src/App.tsx
    - apps/frontend/src/auth/AuthContext.tsx
    - apps/frontend/src/components/layout/Topbar.tsx
    - apps/frontend/src/components/ui/Field.tsx
    - apps/frontend/src/i18n/locales/en.ts
    - apps/frontend/src/i18n/locales/ja.ts

key-decisions:
  - "Exposed accessToken from AuthContextValue and used it (not user) as RequireAuth's authenticated signal — required fix flagged by the plan itself, since /api/auth/refresh's response has no user identity to repopulate `user` on page reload."

requirements-completed: [AUTH-01, AUTH-03]
requirements-partial: []

# Metrics
duration: ~30min (Tasks 1-3, including checkpoint approval)
completed: 2026-09-03
---

# Phase 1 Plan 06: Login/Logout UI + Route Guard Summary

**Login page, RequireAuth route guard, and Topbar logout wired to the existing AuthContext — all 3 tasks complete; Task 3's manual browser verification checkpoint was approved by the user (6/6 steps passed).**

## Performance

- **Duration:** ~30 min (Tasks 1-3, including checkpoint approval)
- **Completed:** 2026-09-03
- **Tasks:** 3/3
- **Files modified:** 8 (2 created, 6 modified)

## Accomplishments

- Added `auth.*` i18n namespace (8 keys) to both `en.ts` and `ja.ts` exactly per 01-UI-SPEC.md's copywriting contract
- `RequireAuth.tsx` (new): redirects unauthenticated visitors to `/login`, preserving the originally-requested location in router state; shows `LoadingState` while the silent-refresh check is in flight
- `App.tsx`: wraps the whole route tree in `AuthProvider`, registers `/login` outside the guard, wraps all 9 existing business routes inside `<Route element={<RequireAuth />}>` — byte-identical route list otherwise
- `LoginPage.tsx` (new): username/password form built from existing `Card`/`Field`/`TextInput`/`Button` primitives; idle → submitting → success/error state machine; on error, the password field is re-focused (not cleared) and an inline `auth.invalidCredentials` message is shown; on success, redirects to the originally-requested route or `/`
- `Topbar.tsx`: static `U` avatar badge converted into a click-to-open dropdown showing the authenticated username and a `Log out` action (ghost button, no confirmation dialog per UI-SPEC); logout calls `useAuth().logout()` then navigates to `/login`
- `Field.tsx`: `TextInput` wrapped in `forwardRef` (additive/backward-compatible — no existing caller passes `ref`) so `LoginPage` can focus it programmatically

## Task Commits

1. **Task 1: i18n keys, RequireAuth guard, App.tsx wiring** - `3602e57` (feat)
2. **Task 2: LoginPage.tsx + Topbar logout entry point** - `1889c06` (feat)
3. **Task 3: manual browser verification** - APPROVED by user (blocking checkpoint, see below); no code changes, verification-only

## Files Created/Modified

- `apps/frontend/src/auth/RequireAuth.tsx` (new) - Route guard component
- `apps/frontend/src/pages/LoginPage.tsx` (new) - Login form page
- `apps/frontend/src/App.tsx` - `AuthProvider` + `RequireAuth` wiring, `/login` route
- `apps/frontend/src/auth/AuthContext.tsx` - Exposed `accessToken` on the context value; silent-refresh success now explicitly sets `user: null` with an inline comment explaining why (see Deviations)
- `apps/frontend/src/components/layout/Topbar.tsx` - Logout dropdown, shows authenticated username
- `apps/frontend/src/components/ui/Field.tsx` - `TextInput` wrapped in `forwardRef`
- `apps/frontend/src/i18n/locales/en.ts` / `ja.ts` - `auth.*` namespace (8 keys each)

## Decisions Made

- Frontend-only plan; no backend business logic touched. Copied `apps/backend/.env` into this worktree and ran `npx prisma generate` only to support starting dev servers for the Task 3 checkpoint (not because backend code changed).
- Since the parent repo's dev servers were already occupying ports 4000/5173 (confirmed via process inspection — those processes run from `C:\Users\KuMo\Documents\GitHub\Storage_Demo\apps\{frontend,backend}`, not this worktree), started this worktree's own verification servers on alternate ports instead of killing the parent's processes: backend on `4001` (`PORT=4001`), frontend on `5174` (`vite --port 5174 --strictPort`, `VITE_API_BASE_URL=http://localhost:4001/api`), with `ALLOWED_ORIGINS` extended to include the `5174` origin. No tracked files were modified for this — all overrides were shell env vars / CLI flags at server-start time.
- Verified the login/invalid-credentials flow directly against the running backend via curl before handing off to the human: valid `admin`/`changeme123` login returns 200 with `{accessToken, user}`; invalid password returns 401 with `{"error":"Invalid username or password"}` — confirms Task 3 steps 4-5's backend behavior ahead of the browser check.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed RequireAuth's authenticated signal to use accessToken instead of user**
- **Found during:** Task 1, implementing `RequireAuth.tsx` per the plan's own flagged note
- **Issue:** The plan's own `<action>` text for Task 1 explicitly flagged that `/api/auth/refresh` (from 01-04/01-05) does not return user identity, so a page-refresh-driven silent refresh leaves `user` null even when the session is valid — checking `!user` in `RequireAuth` would incorrectly bounce a logged-in user back to `/login` on every page refresh (breaking AUTH-03, the exact behavior Task 3 step 6 verifies).
- **Fix:** Added `accessToken` to `AuthContextValue` (exported from `AuthContext.tsx`), and `RequireAuth` now checks `!accessToken` rather than `!user`. Also corrected `AuthContext.tsx`'s silent-refresh success handler, which previously called `applyToken(token, user)` — referencing `user` from a stale closure (always `null` at mount, due to the empty-deps `useEffect`) — replaced with `applyToken(token, null)` plus an inline comment, since the stale-closure argument was misleading even though it evaluated to the same value.
- **Files modified:** `apps/frontend/src/auth/AuthContext.tsx`, `apps/frontend/src/auth/RequireAuth.tsx`
- **Verification:** `tsc -b --noEmit` compiles cleanly; logic reviewed against the documented 01-05 limitation.
- **Committed in:** `3602e57` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug fix explicitly anticipated and flagged by the plan itself)
**Impact on plan:** No scope creep — this was the exact contingency the plan's Task 1 `<action>` text called out in advance ("the fix is to treat 'has an access token' as sufficient... flag this in the SUMMARY if observed").

## Issues Encountered

- Pre-existing `tsc` type errors in `apps/frontend/src/i18n/locales/ja.ts` (`productCount`, `badge`, `count` key naming vs. i18next pluralization suffixes) — same 3 errors documented in `01-05-SUMMARY.md` and `deferred-items.md`, unrelated to this plan's `auth.*` additions, left untouched (out of scope per file-list and scope-boundary rule).
- Ports 4000/5173 were occupied by dev servers running from the parent repo checkout, not this worktree — could not reuse them for Task 3 verification since they would not reflect this plan's code changes. Started this worktree's own servers on ports 4001 (backend)/5174 (frontend) instead of stopping the parent's processes (avoided a destructive action against a process not started by this session).

## Checkpoint Approval (Task 3)

The Task 3 blocking checkpoint (manual browser verification) was approved by the user with "approved". All 6 verification steps behaved as expected:

1. Visiting `/` while unauthenticated redirects to `/login` — PASSED
2. Submitting invalid credentials shows an inline error, password field keeps focus — PASSED
3. Submitting valid credentials (`admin` / `changeme123`) logs in and redirects to `/`, Topbar shows "admin" — PASSED
4. Refreshing the browser (F5) while on `/` keeps the session (AUTH-03 — session persists across refresh) — PASSED
5. Clicking "Log out" from the Topbar dropdown redirects to `/login` — PASSED
6. Navigating directly to a protected route (e.g. `/products`) while logged out redirects to `/login` — PASSED

No code changes were made for Task 3 — it is verification-only. This closes out the plan's `<success_criteria>`.

## Next Phase Readiness

- Task 3 checkpoint approved. This plan's `<success_criteria>` (login/refresh/logout fully working through the UI) is met, and plans 01-07/08/09 (backend `requireAuth` rollout to business routes) can now proceed.
- All 10 pre-existing business routes remain backend-unenforced (staged rollout intact) — this plan only adds the frontend UX layer, consistent with the plan's own threat model (T-01-15, accepted).

## Threat Flags

None - `RequireAuth`, `LoginPage`, and the Topbar logout entry point are all covered by this plan's own `<threat_model>` (T-01-15, accepted: frontend gate is UX-only, not a security boundary).

---
*Phase: 01-authentication*
*Status: Complete — all 3 tasks done, Task 3 checkpoint approved by user*

## Self-Check: PASSED

- FOUND: apps/frontend/src/auth/RequireAuth.tsx
- FOUND: apps/frontend/src/pages/LoginPage.tsx
- FOUND: apps/frontend/src/App.tsx
- FOUND: apps/frontend/src/auth/AuthContext.tsx
- FOUND: apps/frontend/src/components/layout/Topbar.tsx
- FOUND: apps/frontend/src/components/ui/Field.tsx
- FOUND: apps/frontend/src/i18n/locales/en.ts
- FOUND: apps/frontend/src/i18n/locales/ja.ts
- FOUND: commit 3602e57
- FOUND: commit 1889c06
