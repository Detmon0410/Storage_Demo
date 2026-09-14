---
phase: 02-rbac-audit-logging
plan: 12
subsystem: auth
tags: [express, prisma, react, jwt, rbac, i18n]

# Dependency graph
requires:
  - phase: 02-rbac-audit-logging
    provides: RoleModel.getUserRoleCodes/getUserPermissionCodes (02-02), requirePermission middleware and USER_MANAGEMENT_FULL/AUDIT_LOG_VIEW permission codes (02-03)
provides:
  - "GET /api/auth/me endpoint returning { id, username, roles, permissions } for the authenticated user"
  - "AuthContext.AuthUser extended with roles/permissions, populated after login and after silent refresh"
  - "nav.ts NavItem.requiresPermission field and a new nav.group.administration group (Users, Audit Log)"
  - "Sidebar.tsx permission-based filtering that fully hides (not disables) ungranted nav items and empty groups"
affects: [02-13, 02-14]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frontend permission-derived UI gating: AuthContext exposes live permissions fetched from /auth/me; consumers filter arrays/JSX by user?.permissions.includes(...) rather than caching a login-time snapshot"

key-files:
  created:
    - apps/backend/tests/auth.me.test.ts
  modified:
    - apps/backend/src/controllers/auth.controller.ts
    - apps/backend/src/routes/auth.routes.ts
    - apps/frontend/src/auth/AuthContext.tsx
    - apps/frontend/src/components/layout/nav.ts
    - apps/frontend/src/components/layout/Sidebar.tsx
    - apps/frontend/src/i18n/locales/en.ts
    - apps/frontend/src/i18n/locales/ja.ts

key-decisions:
  - "GET /api/auth/me is gated by requireAuth only (no requirePermission) since it is self-scoped — a user can only ever read their own roles/permissions, matching /auth/refresh's auth level"
  - "login() now performs two round-trips (login then /auth/me) — accepted since it happens once per session start, not per-request"
  - "Added missing en/ja i18n keys for the new nav group/items (Rule 2) since the plan's interface spec introduced labelKeys with no corresponding translation entries, which would have rendered as raw i18n keys in the UI"

patterns-established:
  - "Frontend permission-derived UI gating: AuthContext exposes live permissions fetched from /auth/me; consumers filter arrays/JSX by user?.permissions.includes(...) rather than caching a login-time snapshot"

requirements-completed: [RBAC-03, RBAC-06]

# Metrics
duration: 25min
completed: 2026-09-14
---

# Phase 02 Plan 12: Auth /me endpoint, AuthContext roles/permissions, nav gating Summary

**GET /api/auth/me built on the existing RoleModel permission-union queries, wired into AuthContext's login/silent-refresh flow, and a new Administration nav group hidden entirely (not disabled) for users lacking USER_MANAGEMENT_FULL/AUDIT_LOG_VIEW.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-09-14T07:02:00Z
- **Completed:** 2026-09-14T07:27:44Z
- **Tasks:** 3
- **Files modified:** 8 (1 created, 7 modified)

## Accomplishments
- New `GET /api/auth/me` endpoint reuses `RoleModel.getUserRoleCodes`/`getUserPermissionCodes` (no reimplementation), self-scoped via `req.userId` from `requireAuth`
- `AuthContext`'s `AuthUser` now carries `roles`/`permissions`, refreshed after both `login()` and the page-reload silent-refresh flow (closing the previously-documented "user stays null after reload" gap)
- Sidebar now fully hides Users/Audit Log nav items — and their parent group heading when empty — for users lacking the relevant permission, per the UI spec's explicit "no greyed-out state" requirement

## Task Commits

Each task was committed atomically:

1. **Task 1: GET /api/auth/me endpoint (backend)** - `b87ab90` (feat)
2. **Task 2: AuthContext fetches /auth/me after login and silent refresh** - `b2f8b3e` (feat)
3. **Task 3: nav.ts requiresPermission field + Sidebar.tsx filtering** - `babb8ef` (feat)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `apps/backend/src/controllers/auth.controller.ts` - Added `me` handler returning `{ id, username, roles, permissions }`
- `apps/backend/src/routes/auth.routes.ts` - Wired `GET /me` with `requireAuth`
- `apps/backend/tests/auth.me.test.ts` - Asserts response matches `RoleModel` output directly (not hardcoded seed data) and 401 for anonymous
- `apps/frontend/src/auth/AuthContext.tsx` - Extended `AuthUser`, added `fetchMe`, wired into `login()` and silent-refresh `useEffect`
- `apps/frontend/src/components/layout/nav.ts` - Added `requiresPermission?: string` and the `nav.group.administration` group (Users/Audit Log)
- `apps/frontend/src/components/layout/Sidebar.tsx` - Filters `NAV_GROUPS` into `visibleGroups` by `user?.permissions`
- `apps/frontend/src/i18n/locales/en.ts` / `ja.ts` - Added `nav.group.administration`, `nav.item.users`, `nav.item.auditLogs` translation keys

## Decisions Made
- `/auth/me` requires only `requireAuth`, not `requirePermission` — there's nothing to authorize beyond "is this a valid session" since the endpoint always derives from the caller's own `req.userId`
- `login()` accepts a second round-trip to `/auth/me` after the initial login response, since this only happens once per session start
- Added i18n translation keys for the new nav labels (Rule 2 — missing critical functionality: without them, `t()` would render the raw dotted key string in the sidebar)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added en/ja i18n keys for new nav labels**
- **Found during:** Task 3 (nav.ts requiresPermission field + Sidebar.tsx filtering)
- **Issue:** The plan's `<interfaces>` block specified `labelKey: "nav.item.users"` / `"nav.item.auditLogs"` and `titleKey: "nav.group.administration"`, but neither `en.ts` nor `ja.ts` had these keys defined. Without them, `react-i18next` would render the raw key string in the UI instead of a human label.
- **Fix:** Added `nav.group.administration`, `nav.item.users`, `nav.item.auditLogs` to both `en.ts` and `ja.ts`, matching the existing structure/tone of neighboring entries.
- **Files modified:** `apps/frontend/src/i18n/locales/en.ts`, `apps/frontend/src/i18n/locales/ja.ts`
- **Verification:** `npx tsc --noEmit -p .` passes (ja.ts is typed against en.ts's `TranslationSchema`, so a missing/mismatched key would fail the build)
- **Committed in:** `babb8ef` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Necessary for the new nav items to render correctly; no scope creep beyond the plan's own interface spec.

## Issues Encountered
- The worktree had no `node_modules` installed and no `apps/backend/.env` (gitignored, not part of any commit) — ran `pnpm install` + `prisma generate`, and copied `.env` from the main checkout to unblock running the backend test suite. No code or config changes resulted from this; purely local environment setup.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plans 02-13 (Users page) and 02-14 (Audit Log page) can now rely on `useAuth().user.permissions` for gating and on `/api/auth/me` as the source of truth for the current user's roles/permissions
- The `/users` and `/audit-logs` routes referenced by the new nav items are not yet registered in `App.tsx` — expected, since those pages are built in plans 02-13/02-14

---
*Phase: 02-rbac-audit-logging*
*Completed: 2026-09-14*

## Self-Check: PASSED

All 6 created/modified source files and this SUMMARY.md verified present on disk. All 3 task commits (`b87ab90`, `b2f8b3e`, `babb8ef`) verified present in `git log`.
