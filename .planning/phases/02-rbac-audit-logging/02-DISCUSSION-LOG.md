# Phase 2: RBAC & Audit Logging - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-03
**Phase:** 02-rbac-audit-logging
**Areas discussed:** Approve/Reject design, Permission granularity, New UI scope, Audit log access

---

## Approve/Reject (ahead of Phase 4 workflow)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal dedicated endpoints now | Add POST /:id/approve, /:id/reject now — permission + no-self-approval + audit, forward-compatible with Phase 4 | ✓ |
| Detect via generic update | Leave generic PUT as-is, audit middleware detects status change to approved/rejected | |
| Defer entirely to Phase 4 | No approve/reject handling in Phase 2 at all | |

**User's choice:** Minimal dedicated endpoints now (recommended option)
**Notes:** ImportOrder/SalesOrder currently only have a free-text `approver` field written via the generic update endpoint, with no permission check or audit distinction. This closes that gap now rather than waiting for Phase 4's full status machine.

---

## Permission Granularity

| Option | Description | Selected |
|--------|-------------|----------|
| Module + action | One code per module×action from the role doc's matrix (~40-60 codes) | ✓ |
| Module-level only | One permission per module, can't distinguish view/edit | |
| Hardcoded role checks, no permission table | Skip permissions/role_permissions tables entirely | |

**User's choice:** Module + action (recommended option)
**Notes:** Matches the role doc's Section 7 matrix directly — seed permissions from that table rather than inventing a different taxonomy.

---

## New UI (User Management + Audit Log Viewer)

| Option | Description | Selected |
|--------|-------------|----------|
| Run /gsd-ui-phase after this | Design contract for two new admin screens before planning | ✓ |
| Skip — keep it plain | Extend existing CRUD table+modal pattern directly, no separate design pass | |

**User's choice:** Run /gsd-ui-phase after this (recommended option)
**Notes:** Two genuinely new screens (multi-role assignment UX, audit filter UI) — warrants the same design-contract treatment Phase 1's login page got.

---

## Audit Log Access Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full scoped visibility (per role doc) | Admin/Manager see all; other roles see only their own/related entries | |
| Simple: Admin/Manager only | Only Admin and Manager/Approver can view audit log at all in Phase 2 | ✓ |

**User's choice:** Simple: Admin/Manager only (recommended option)
**Notes:** Satisfies AUDIT-04's "authorized user" wording without building per-row ownership-scoping logic in this phase. Full "Own/Related" scoping explicitly deferred.

---

## Claude's Discretion

- Audit-write implementation: middleware wrapping mutating routes vs explicit per-controller calls — left to research/planning to determine what's most transaction-safe with Prisma
- Self-lockout protection for the last System Admin — no explicit rule given, use reasonable judgment
- Exact HTTP verbs/paths for approve/reject endpoints beyond the general shape specified

## Deferred Ideas

- Full approval status machine — Phase 4 (already on roadmap, not a new idea)
- "Own/Related" scoped audit visibility — deferred, may revisit later
- Export-action audit logging — mechanism should support it, nothing to instrument until Phase 6
- 8-role detailed structure — explicitly out of scope per PROJECT.md
