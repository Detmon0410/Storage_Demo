# Phase 2: RBAC & Audit Logging - Context

**Gathered:** 2026-09-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Every mutating action is gated by a real permission check derived from the database on each
request, and recorded for accountability. This phase delivers: the roles/permissions schema,
a permission-check middleware wired onto every existing mutating route (same staged-rollout
pattern as Phase 1's `requireAuth`), a System Admin user-management screen, minimal approve/reject
endpoints for ImportOrder/SalesOrder (ahead of Phase 4's full status machine), and an append-only
audit log with a viewer UI.

Full approval workflow (status machine, thresholds, DRAFT/PENDING_APPROVAL/etc.) is Phase 4 —
not this phase. Export-action audit logging (AUDIT-02) has nothing to instrument yet since no
export feature exists until Phase 6 — the audit *mechanism* must support an "export" action type
so Phase 6 can call it, but there's no export endpoint to wire it into now.

</domain>

<decisions>
## Implementation Decisions

### Approve/Reject (ahead of Phase 4's full workflow)
- **D-01:** Add minimal dedicated `POST /api/import-orders/:id/approve`, `POST /api/import-orders/:id/reject`, `POST /api/sales-orders/:id/approve`, `POST /api/sales-orders/:id/reject` endpoints now — replacing ad-hoc `approver` field writes via the generic update endpoint for status transitions to approved/rejected. These endpoints:
  - Require `IMPORT_ORDER_APPROVE` / `SALES_ORDER_APPROVE` permission (Manager/Approver role, per the role doc's matrix)
  - Enforce no-self-approval: reject if the requesting user is the order's `createdBy`/original creator
  - Emit an AUDIT-02 `approve`/`reject` audit event
  - Phase 4 will replace/extend this with the full status machine — the permission-check and audit-emission plumbing built here should carry forward unchanged, only the state-transition logic itself changes.
- Note for the planner: the existing generic `PUT /:id` update endpoint should likely stop allowing arbitrary `approver`/`status` writes to "approved"/"rejected" once the dedicated endpoints exist, to avoid a bypass path — flag this as a research/planning question (research phase should confirm current test coverage before changing update endpoint behavior).

### Permission Model
- **D-02:** Permission codes are module + action level, directly matching the role doc's Section 7 permission matrix (e.g. `PRODUCT_VIEW`, `PRODUCT_CREATE`, `SALES_ORDER_APPROVE`, `USER_MANAGEMENT_FULL`). Expect roughly 40-60 codes across ~19 modules — seed them directly from the matrix, do not invent a different taxonomy.
- Schema: `users` / `roles` / `user_roles` / `permissions` / `role_permissions` as specified in `liquor-system-basic-role-permission-recommendation.md` §5 — additive to existing Prisma schema, must not break existing CRUD.
- **RBAC-06 is a hard constraint, not a gray area:** permission checks are re-derived from the DB on every request. Do not bake permissions into the JWT access token (which already exists from Phase 1 and stays short-lived/stateless for identity only).
- Role codes: use the exact stable codes from the role doc §9 (`SYSTEM_ADMIN`, `MANAGER_APPROVER`, `IMPORT_COMPLIANCE_OFFICER`, `WAREHOUSE_DISTRIBUTION_OFFICER`, `SALES_OFFICER`, `FINANCE_ACCOUNTING_OFFICER`).
- Enforcement pattern mirrors Phase 1: a `requirePermission("CODE")` middleware, wired per-route-per-method, following the exact same wave-by-wave staged rollout style already proven in Phase 1 (waves 7-9). The planner should structure plans the same way (e.g. wire read-permission checks in one wave, write-permission in another) if that reduces risk, though this phase is smaller in route-file scope than Phase 1's blanket auth rollout since it also needs the schema/seed/admin-UI work first.
- The default System Admin user seeded in Phase 1 (`admin` / `changeme123`) must be assigned the `SYSTEM_ADMIN` role as part of this phase's seed/migration work — without this, the admin account loses ability to do anything once permission checks land.

### New UI
- **D-03:** Run `/gsd-ui-phase 2` after this discussion, before planning, to produce a design contract for two new screens:
  1. **User management** (System Admin only) — create/edit/deactivate/reactivate users, assign one or more of the 6 roles per user
  2. **Audit log viewer** — filterable by entity, user, action, date range (AUDIT-04)
- Reuse the existing Tailwind design system and existing CRUD table+modal pattern already established for Suppliers/Products/Customers — no new component library, no new visual language. The UI-SPEC should focus on the multi-role-assignment interaction (checkboxes/multi-select for 6 roles) and the audit log's filter/table layout, not reinvent the base patterns.

### Audit Log Access
- **D-04:** In this phase, the audit log viewer is visible only to `SYSTEM_ADMIN` and `MANAGER_APPROVER` roles. The role doc's "Own/Related" scoped-visibility for other roles is explicitly deferred — not built in Phase 2. Simple binary access (admin/manager: full log; everyone else: no audit log screen access at all) satisfies AUDIT-04's "authorized user" wording without building per-row ownership-scoping logic now.

### Audit Log Data Model
- **AUDIT-01** requires before/after values on every create/update/delete. Capture as JSON before/after snapshots of the changed record (not a field-by-field diff structure) — simpler to implement generically across all entity types, and the viewer can compute a diff for display if needed. This should be a single reusable audit-writing utility/middleware called from every mutating controller, not duplicated per-entity logic.
- Audit log table must be genuinely append-only at the application layer: no `PUT`/`DELETE` route exists for it, ever (AUDIT-03).

### Claude's Discretion
- Whether the audit-write happens via an Express middleware wrapping each mutating route, or an explicit call inside each controller — pick whichever is more reliable for capturing accurate before/after snapshots given Prisma's query patterns (research phase should investigate transaction-safety here, since audit write and the actual mutation should probably be atomic).
- Whether a System Admin can deactivate/remove their own admin role (potential self-lockout) — no explicit rule from the user or the role doc; use reasonable judgment (e.g. block removing the last active SYSTEM_ADMIN in the system, but don't over-engineer this for a single-admin-org context).
- Exact HTTP verbs/paths for the new approve/reject endpoints beyond what's specified above.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Role & Permission Design (authoritative)
- `liquor-system-basic-role-permission-recommendation.md` — full role definitions (§6), DB schema (§5), permission matrix (§7), minimum permission rules including no-self-approval (§8), sensitive field control (§8.4), role codes (§9)

### Requirements & Priority
- `liquor-system-improvement-advice.md` §6 "Authentication, Roles, And Audit Logs" — requirements + acceptance criteria for this phase; confirms suggested build order (auth → roles/audit → backend enforcement → ...)

### Project-Level
- `.planning/PROJECT.md` — core value, constraints (backend-first enforcement, no self-approval, schema evolution must be additive), key decisions table
- `.planning/REQUIREMENTS.md` — RBAC-01 through RBAC-06, AUDIT-01 through AUDIT-04 with full requirement text
- `.planning/ROADMAP.md` §"Phase 2: RBAC & Audit Logging" — goal, success criteria, dependency on Phase 1

### Prior Phase Precedent
- `.planning/phases/01-authentication/01-CONTEXT.md`, `01-RESEARCH.md`, and all `01-*-SUMMARY.md` files — establishes the staged-rollout pattern (enforce reads before writes, wave-by-wave across route files), the JWT/requireAuth middleware this phase builds on top of, and the `@node-rs/argon2` substitution (relevant if this phase touches password-related user-management flows)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/middleware/auth.ts` (`requireAuth`) — Phase 1's auth middleware; a new `requirePermission(code)` middleware should compose with it (verify identity first, then permission), following the same file/naming convention
- Existing CRUD table+modal frontend pattern (Suppliers/Products/Customers pages) — extend to Users page and Audit Log page rather than inventing new UI patterns
- `apps/backend/prisma/seed.ts` — already seeds the default System Admin user (Phase 1, D-05); this phase extends it to also seed roles/permissions and assign `SYSTEM_ADMIN` to that user

### Established Patterns
- Per-route-per-method middleware wiring (`router.get("/", requireAuth, handler)`) — `requirePermission` slots into the same chain
- Generic update endpoints currently accept arbitrary field writes including `approver`/`status` (see `importOrder.controller.ts`, `salesOrder.controller.ts`, `importOrder.model.ts`, `salesOrder.model.ts`) — this is the gap the new approve/reject endpoints close
- Backend test pattern: vitest + supertest, TDD RED/GREEN commits, tests co-located in `apps/backend/tests/`, isolated via `fileParallelism: false` (added in Phase 1 to fix a cross-file race — carry this config forward, don't revert it)

### Integration Points
- `apps/backend/prisma/schema.prisma` — additive models: `Role`, `Permission`, `UserRole` (join), `RolePermission` (join), plus an `AuditLog` model
- All 11 existing route files (`category`, `customer`, `customerLicense`, `dashboardKpi`, `importOrder`, `inventoryStock`, `license`, `product`, `salesOrder`, `stockTransaction`, `supplier`) — each mutating method needs a `requirePermission` check added
- `apps/frontend/src/api/client.ts` / `AuthContext.tsx` — frontend already has an authenticated API client from Phase 1; new Users/Audit-log pages consume it the same way existing pages do

</code_context>

<specifics>
## Specific Ideas

No additional specific visual/UX references beyond what's captured in Decisions — the two source docs (role doc + improvement-advice doc) are detailed enough to serve as the spec for this phase.

</specifics>

<deferred>
## Deferred Ideas

- Full approval status machine (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED) — Phase 4, per roadmap
- "Own/Related" scoped audit log visibility for non-admin/manager roles — deferred past Phase 2 (D-04); revisit if a future phase or user feedback requires it
- Export-action audit logging — the audit *mechanism* should support an "export" action type, but there's nothing to instrument until Phase 6 builds actual export endpoints
- 8-role detailed structure — explicitly out of scope per PROJECT.md, not revisited

</deferred>

---

*Phase: 02-rbac-audit-logging*
*Context gathered: 2026-09-03*
