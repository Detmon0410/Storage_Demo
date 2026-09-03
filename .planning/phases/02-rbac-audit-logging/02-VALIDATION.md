---
phase: 02
slug: rbac-audit-logging
status: draft
nyquist_compliant: false
wave_0_complete: true
created: 2026-09-03
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 2.1.9 + supertest (already installed, Phase 1) |
| **Config file** | apps/backend/vitest.config.ts (fileParallelism: false — carry forward, do not revert) |
| **Quick run command** | `pnpm --filter backend exec vitest run tests/{file}.test.ts` |
| **Full suite command** | `pnpm --filter backend test` |
| **Estimated runtime** | ~7-10 seconds (33 tests as of Phase 1; will grow with RBAC/audit tests) |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the file just touched
- **After every plan wave:** Run the full suite command
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — vitest/supertest/fileParallelism:false already in place from Phase 1. No new test framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| User management UI (create/edit/deactivate/reactivate, multi-role assignment) | RBAC-05 | Visual/interaction UI, no automated browser testing in this project | Log in as System Admin, create a user, assign 2+ roles, deactivate, reactivate — confirm each step reflects correctly in the table |
| Audit log viewer UI (filters by entity/user/action/date range) | AUDIT-04 | Visual/interaction UI | As System Admin, perform a create/update/delete, then filter the audit log by each of the 4 filter types and confirm the entry appears/disappears correctly |
| Role revocation takes effect without re-login | RBAC-06 | Requires two concurrent browser sessions (admin + affected user) to observe live effect | Log in as a non-admin user in one browser, remove their role as admin in another, confirm the first user's very next request is denied without them logging out/in |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (existing infra covers this)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none missing)
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter (set once planner confirms per-task verify commands in PLAN.md files)

**Approval:** pending
