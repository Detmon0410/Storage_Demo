# Deferred Items — Phase 01 Authentication

Items discovered during execution that are out of scope for the current task and were not fixed.

## From Plan 01-05

- **Pre-existing `tsc -b --noEmit` errors in `apps/frontend/src/i18n/locales/ja.ts`** (lines ~149, ~303, ~384) — object literals referencing i18next pluralization keys (`productCount`, `badge`, `count`) that don't match the generated types (`productCount_one`, `badge_one`/`badge_other`, `count_one`/`count_other`). Confirmed pre-existing via `git stash` + re-run before this plan's changes — unrelated to `client.ts`/`AuthContext.tsx`. Out of scope per plan 01-05 (no i18n files in its `<files>` list). Not fixed.
