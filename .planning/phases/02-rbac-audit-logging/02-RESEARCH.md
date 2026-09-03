# Phase 2: RBAC & Audit Logging - Research

**Researched:** 2026-09-03
**Domain:** Database-backed RBAC (roles/permissions, many-to-many, re-derived per request) + generic transactional audit logging, retrofitted onto an Express 4.21 / Prisma 6.4.1 / MySQL backend that already has JWT auth (Phase 1 complete) but zero permission or audit infrastructure.
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Approve/Reject (ahead of Phase 4's full workflow)**
- D-01: Add minimal dedicated `POST /api/import-orders/:id/approve`, `POST /api/import-orders/:id/reject`, `POST /api/sales-orders/:id/approve`, `POST /api/sales-orders/:id/reject` endpoints now — replacing ad-hoc `approver` field writes via the generic update endpoint for status transitions to approved/rejected. These endpoints:
  - Require `IMPORT_ORDER_APPROVE` / `SALES_ORDER_APPROVE` permission (Manager/Approver role, per the role doc's matrix)
  - Enforce no-self-approval: reject if the requesting user is the order's `createdBy`/original creator
  - Emit an AUDIT-02 `approve`/`reject` audit event
  - Phase 4 will replace/extend this with the full status machine — the permission-check and audit-emission plumbing built here should carry forward unchanged, only the state-transition logic itself changes.
- Note for the planner: the existing generic `PUT /:id` update endpoint should likely stop allowing arbitrary `approver`/`status` writes to "approved"/"rejected" once the dedicated endpoints exist, to avoid a bypass path — flag this as a research/planning question (research phase should confirm current test coverage before changing update endpoint behavior).

**Permission Model**
- D-02: Permission codes are module + action level, directly matching the role doc's Section 7 permission matrix (e.g. `PRODUCT_VIEW`, `PRODUCT_CREATE`, `SALES_ORDER_APPROVE`, `USER_MANAGEMENT_FULL`). Expect roughly 40-60 codes across ~19 modules — seed them directly from the matrix, do not invent a different taxonomy.
- Schema: `users` / `roles` / `user_roles` / `permissions` / `role_permissions` as specified in `liquor-system-basic-role-permission-recommendation.md` §5 — additive to existing Prisma schema, must not break existing CRUD.
- **RBAC-06 is a hard constraint, not a gray area:** permission checks are re-derived from the DB on every request. Do not bake permissions into the JWT access token (which already exists from Phase 1 and stays short-lived/stateless for identity only).
- Role codes: use the exact stable codes from the role doc §9 (`SYSTEM_ADMIN`, `MANAGER_APPROVER`, `IMPORT_COMPLIANCE_OFFICER`, `WAREHOUSE_DISTRIBUTION_OFFICER`, `SALES_OFFICER`, `FINANCE_ACCOUNTING_OFFICER`).
- Enforcement pattern mirrors Phase 1: a `requirePermission("CODE")` middleware, wired per-route-per-method, following the exact same wave-by-wave staged rollout style already proven in Phase 1 (waves 7-9). The planner should structure plans the same way (e.g. wire read-permission checks in one wave, write-permission in another) if that reduces risk, though this phase is smaller in route-file scope than Phase 1's blanket auth rollout since it also needs the schema/seed/admin-UI work first.
- The default System Admin user seeded in Phase 1 (`admin` / `changeme123`) must be assigned the `SYSTEM_ADMIN` role as part of this phase's seed/migration work — without this, the admin account loses ability to do anything once permission checks land.

**New UI**
- D-03: Run `/gsd-ui-phase 2` after this discussion, before planning, to produce a design contract for two new screens (DONE — see `02-UI-SPEC.md`):
  1. **User management** (System Admin only) — create/edit/deactivate/reactivate users, assign one or more of the 6 roles per user
  2. **Audit log viewer** — filterable by entity, user, action, date range (AUDIT-04)
- Reuse the existing Tailwind design system and existing CRUD table+modal pattern already established for Suppliers/Products/Customers — no new component library, no new visual language.

**Audit Log Access**
- D-04: In this phase, the audit log viewer is visible only to `SYSTEM_ADMIN` and `MANAGER_APPROVER` roles. The role doc's "Own/Related" scoped-visibility for other roles is explicitly deferred — not built in Phase 2. Simple binary access (admin/manager: full log; everyone else: no audit log screen access at all) satisfies AUDIT-04's "authorized user" wording without building per-row ownership-scoping logic now.

**Audit Log Data Model**
- AUDIT-01 requires before/after values on every create/update/delete. Capture as JSON before/after snapshots of the changed record (not a field-by-field diff structure) — simpler to implement generically across all entity types, and the viewer can compute a diff for display if needed. This should be a single reusable audit-writing utility/middleware called from every mutating controller, not duplicated per-entity logic.
- Audit log table must be genuinely append-only at the application layer: no `PUT`/`DELETE` route exists for it, ever (AUDIT-03).

### Claude's Discretion
- Whether the audit-write happens via an Express middleware wrapping each mutating route, or an explicit call inside each controller — pick whichever is more reliable for capturing accurate before/after snapshots given Prisma's query patterns (research phase should investigate transaction-safety here, since audit write and the actual mutation should probably be atomic). **RESOLVED by this research — see Architecture Pattern 2.**
- Whether a System Admin can deactivate/remove their own admin role (potential self-lockout) — no explicit rule from the user or the role doc; use reasonable judgment (e.g. block removing the last active SYSTEM_ADMIN in the system, but don't over-engineer this for a single-admin-org context). **UI-SPEC already assumes this guard exists (`user.toastLastAdminGuard`) — backend must implement it.**
- Exact HTTP verbs/paths for the new approve/reject endpoints beyond what's specified above.

### Deferred Ideas (OUT OF SCOPE)
- Full approval status machine (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED) — Phase 4, per roadmap
- "Own/Related" scoped audit log visibility for non-admin/manager roles — deferred past Phase 2 (D-04); revisit if a future phase or user feedback requires it
- Export-action audit logging — the audit *mechanism* should support an "export" action type, but there's nothing to instrument until Phase 6 builds actual export endpoints
- 8-role detailed structure — explicitly out of scope per PROJECT.md, not revisited
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RBAC-01 | System supports 6 roles per the role doc | Standard Stack (schema), seed data — role codes fixed, see role doc §9 |
| RBAC-02 | A user can be assigned one or more roles simultaneously | `UserRole` join table, many-to-many — see Architecture Patterns |
| RBAC-03 | Effective permissions = union of all assigned roles' permissions | `requirePermission` middleware query pattern — see Pattern 1 |
| RBAC-04 | Every mutating endpoint checks permission before executing | Staged rollout pattern mirroring Phase 1 — see Pattern 3, Common Pitfalls |
| RBAC-05 | System Admin can create/edit/deactivate/reactivate users, assign/remove roles | User management endpoints + self-lockout guard — see Pattern 4, Common Pitfalls |
| RBAC-06 | Permissions re-derived from DB per request, not baked into JWT | `requirePermission` always queries DB, JWT payload stays `{userId}` only — see Pattern 1 |
| AUDIT-01 | Every create/update/delete recorded with user, timestamp, entity, before/after values | Generic audit-write utility inside `$transaction` — see Pattern 2, Code Examples |
| AUDIT-02 | Login, logout, approve, reject, export recorded as audit events | Extend `auth.controller.ts` login/logout; approve/reject endpoints call same utility — see Pattern 2 |
| AUDIT-03 | Audit log entries cannot be edited or deleted through any screen or API | No PUT/DELETE route ever registered for `/api/audit-logs` — see Don't Hand-Roll, Architecture |
| AUDIT-04 | Authorized users can view audit history filtered by entity, user, action, date range | `GET /api/audit-logs` with query filters, `requirePermission("AUDIT_LOG_VIEW")` restricted to Admin/Manager roles (D-04) — see Code Examples |
</phase_requirements>

## Summary

This phase adds two additive concerns to a codebase that already has working JWT authentication but no notion of authorization beyond "is there a valid session": (1) a classic 5-table RBAC schema (`Role`, `Permission`, `UserRole`, `RolePermission`, plus the existing `User`) enforced by a new `requirePermission(code)` middleware that re-queries the database on every request (RBAC-06 is explicit and non-negotiable — no JWT caching), and (2) a generic, append-only `AuditLog` table with a reusable write utility called from every mutating controller. Both are purely additive Prisma migrations — no existing model, column, or route needs to be altered to add them, and MySQL (already 5.7+/8.0 per Phase 1) natively supports the `Json` column type Prisma needs for the before/after snapshots.

The two hardest technical questions in this phase are not "which library" (no new runtime dependencies are needed — this is schema + Express middleware + controller wiring, all using packages already installed) but **transaction-safety for audit writes** and **a genuinely missing `createdBy` field**. Investigating the existing model layer (`importOrder.model.ts`, `salesOrder.model.ts`, `customer.model.ts`, etc.) reveals two things that materially change the plan: first, roughly half the models (import orders, sales orders, stock transactions) already wrap their mutations in `prisma.$transaction(async (tx) => {...})` using the singleton `prisma` client, which **cannot be nested** — a controller-level audit wrapper that opens its own `$transaction` cannot re-enter these models' internal transactions, so those models must be refactored to accept an injectable `Prisma.TransactionClient` instead of always opening their own. Second, and more urgent: **`ImportOrder` and `SalesOrder` have no `createdBy`/`userId` field in the current schema at all.** CONTEXT.md's D-01 explicitly requires "no-self-approval: reject if the requesting user is the order's `createdBy`/original creator" for the new approve/reject endpoints — this field must be added as part of this phase's migration, and every existing create-order code path (controllers *and* `prisma/seed.ts`) must be updated to populate it, or self-approval enforcement is impossible to implement.

**Primary recommendation:** Build the RBAC schema + seed (Wave 1), add `createdById` to `ImportOrder`/`SalesOrder` in the same migration, refactor the handful of `$transaction`-using models to accept an optional external `tx` client (Wave 1), build the generic `AuditLogModel.record(tx, {...})` utility and wire it into every existing mutating controller inside a controller-opened `prisma.$transaction` (Wave 2), build `requirePermission` and roll it out route-file by route-file exactly like Phase 1's `requireAuth` staged rollout — reads first, writes second (Wave 3-4), then add the User-management and approve/reject endpoints plus the audit log query endpoint (Wave 5), and finally the two new frontend screens per `02-UI-SPEC.md` (Wave 6).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Role/permission storage | Database / Storage | — | `Role`/`Permission`/`UserRole`/`RolePermission` tables are the single source of truth; nothing cached elsewhere per RBAC-06 |
| Permission derivation (union of roles) | API / Backend | Database / Storage | `requirePermission` middleware computes the union in a single Prisma query per request; never precomputed/stored |
| Permission enforcement (401/403) | API / Backend | — | Middleware on every mutating route; must never be trusted from frontend UI state alone (mirrors Phase 1's core value statement) |
| Audit-write atomicity with mutation | API / Backend | Database / Storage | Both writes happen inside one `prisma.$transaction`; if either fails, both roll back — enforced at the Prisma/MySQL transaction boundary, not application retry logic |
| Audit log storage (append-only) | Database / Storage | API / Backend | DB has no special append-only constraint (MySQL lacks native immutable tables); enforcement is purely "no PUT/DELETE route exists" at the API tier — a deliberate, documented trust boundary |
| Audit log query/filter | API / Backend | Database / Storage | `GET /api/audit-logs?entity=&user=&action=&from=&to=` — filtering happens in the Prisma `where` clause, not client-side, given audit volume can grow unbounded |
| User management (create/edit/deactivate/role-assign) | API / Backend | Database / Storage | `SYSTEM_ADMIN`-gated CRUD on `User` + `UserRole`; self-lockout guard is backend business logic, not a DB constraint |
| Role/permission checkbox UI, audit filter UI | Browser / Client | — | Pure presentation reusing existing `CheckboxField`/`DataTable`/`Modal` primitives per `02-UI-SPEC.md`; zero business logic client-side |
| Nav visibility gating (Users/Audit Log sidebar items) | Browser / Client | API / Backend | Cosmetic-only convenience (hide, don't disable) — the real gate is always the backend `requirePermission` check; frontend hiding is UX polish, not security |

## Standard Stack

### Core

No new runtime dependencies are required for this phase. Everything needed (Prisma many-to-many relations, `Json` columns, Express middleware) is already installed from Phase 1.

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@prisma/client` / `prisma` | 6.4.1 (project-pinned) | ORM, migrations, `Json` scalar for audit snapshots, `$transaction` for atomicity | Already the project's ORM; MySQL `Json` column type supported since Prisma 2.x, no upgrade needed. `[VERIFIED: apps/backend/package.json, apps/backend/prisma/schema.prisma]` |
| `express` | 4.21.2 (installed) | Route/middleware composition for `requirePermission` | Already the project's framework; `requirePermission` is a plain Express middleware, same shape as `requireAuth`. `[VERIFIED: apps/backend/package.json]` |
| `@node-rs/argon2` | 2.2.0 (installed) | Password hashing for new users created via User Management screen | Already substituted in for `argon2` in Phase 1 after the native-binding segfault on this Windows/Node 20.19 environment (see Common Pitfalls). Reuse the same import (`@node-rs/argon2`), do not reintroduce `argon2`. `[VERIFIED: apps/backend/package.json, apps/backend/prisma/seed.ts]` |
| `zod` | 4.5.4 (installed) | Validate new endpoint request bodies (user create/edit, approve/reject, audit-log filter query params) | Already installed from Phase 1's STACK.md recommendation; extend usage to this phase's new routes. `[VERIFIED: apps/backend/package.json]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` / `supertest` | 2.1.8 / 7.0.0 (installed) | TDD for permission-denial matrix, audit-write atomicity, self-lockout guard | Already the project's test stack from Phase 1; extend, do not replace. `[VERIFIED: apps/backend/package.json]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DB-derived permissions re-queried per request (RBAC-06) | Permissions embedded in JWT, refreshed only on next login | Explicitly rejected by CONTEXT.md — a revoked role must take effect on the very next request, not after token expiry/re-login. Phase 1's research already anticipated this and deliberately kept the JWT payload to `{userId}` only for this reason. |
| Generic JSON before/after snapshot audit log | Field-by-field diff table (one row per changed column) | CONTEXT.md explicitly chose the simpler JSON-snapshot approach; a diff table is more queryable per-field but adds significant schema/write complexity for no requirement that needs it (AUDIT-01 only requires "before/after values," not per-field diffing) |
| Node built-in `crypto` (already used for refresh tokens) for any new random-value needs | uuid package | Not needed — no new use case in this phase requires a new random-generation library |

**Installation:**
```bash
# No new packages required — this phase is schema + middleware + controller work only.
```

**Version verification:** `npm view prisma version` returns `8.0.0-rc.12` and `npm view @prisma/client version` returns `7.10.0` on the public registry as of 2026-09-03, but the project is pinned to `^6.4.1` and Phase 1 already validated this version against MySQL for `Json`/relation support — **do not upgrade Prisma mid-milestone**; a major-version bump is out of scope for this phase and would introduce unrelated migration risk. `[VERIFIED: npm registry, 2026-09-03]`

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│ BROWSER (React 19 SPA)                                                    │
│  AuthContext (extended): { id, username, roles: string[], permissions:    │
│    string[] } — fetched once after login/refresh via GET /api/auth/me     │
│  Sidebar.tsx: filters NAV_GROUPS by requiresPermission (UX only)          │
│  UsersPage / AuditLogPage: call existing authenticated client.ts          │
└───────────────────────────┬────────────────────────────────────────────┘
                             │ Authorization: Bearer <accessToken>
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ EXPRESS (apps/backend/src/routes/*.routes.ts)                             │
│  router.post("/", requireAuth, requirePermission("PRODUCT_CREATE"), ctrl) │
│  requirePermission(code):                                                 │
│    1. query User -> UserRole -> Role -> RolePermission -> Permission      │
│       (single Prisma query with nested include, per request, no cache)   │
│    2. union permission codes across all assigned roles                    │
│    3. code in set? next() : 403                                           │
│  New routes: /api/users (SYSTEM_ADMIN only), /api/audit-logs (GET only,   │
│    SYSTEM_ADMIN + MANAGER_APPROVER), /api/import-orders/:id/approve|      │
│    reject, /api/sales-orders/:id/approve|reject                           │
└───────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ CONTROLLER LAYER                                                          │
│  Every mutating controller (create/update/delete/approve/reject):         │
│    await prisma.$transaction(async (tx) => {                             │
│      const before = action !== "create" ? await Model.findById(id, tx) : │
│        null;                                                              │
│      const after = await Model.create/update/delete(data, tx);           │
│      await AuditLogModel.record(tx, { entity, entityId, action, userId,  │
│        before, after });                                                  │
│      return after;                                                       │
│    });                                                                    │
│  authController.login/logout: also call AuditLogModel.record (no tx      │
│    needed — single insert, not paired with a business mutation)          │
└───────────────────────────┬────────────────────────────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PRISMA / MYSQL                                                            │
│  Role { roleId, roleCode (unique), roleName }                             │
│  Permission { permissionId, permissionCode (unique), permissionName }     │
│  UserRole { userId, roleId } @@id([userId, roleId])                       │
│  RolePermission { roleId, permissionId } @@id([roleId, permissionId])     │
│  AuditLog { auditLogId, entity, entityId, action, userId, before (Json?), │
│    after (Json?), createdAt } — no updatedAt, no soft-delete flag: this   │
│    table is never mutated after insert (AUDIT-03 enforced by "no route    │
│    exists", not a DB trigger)                                             │
│  ImportOrder / SalesOrder: + createdById Int? (new column, this phase)    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
apps/backend/src/
├── middleware/
│   ├── auth.ts                  # existing — requireAuth (Phase 1, unchanged)
│   └── permission.ts            # new — requirePermission(code), composes after requireAuth
├── lib/
│   └── audit.ts                 # new — AuditLogModel.record(tx, {...}) generic write utility
├── models/
│   ├── role.model.ts            # new — findByUser(), effective permission-set query
│   ├── auditLog.model.ts        # new — record(), findMany() with filters
│   ├── user.model.ts            # existing (Phase 1) — extend with create/update/deactivate/
│   │                             #   reactivate/assignRoles, self-lockout guard
│   ├── importOrder.model.ts     # existing — refactor create/update/delete to accept optional
│   │                             #   external `tx: Prisma.TransactionClient`, add createdById
│   └── salesOrder.model.ts      # existing — same refactor + approve()/reject() methods
├── controllers/
│   ├── user.controller.ts       # new — CRUD + role assignment, SYSTEM_ADMIN only
│   ├── auditLog.controller.ts   # new — GET only, filter by entity/user/action/date range
│   ├── importOrder.controller.ts # existing — wrap mutations in $transaction + audit call;
│   │                              #   add approve/reject handlers
│   └── salesOrder.controller.ts  # existing — same
├── routes/
│   ├── user.routes.ts           # new
│   ├── auditLog.routes.ts       # new — GET / only, no PUT/DELETE ever registered (AUDIT-03)
│   └── index.ts                  # existing — mount new routers
prisma/
├── schema.prisma                 # add Role, Permission, UserRole, RolePermission, AuditLog;
│                                  #   add createdById to ImportOrder, SalesOrder
└── seed.ts                       # extend: seed 6 roles, ~40-60 permissions from role-doc §7,
                                   #   role_permission mappings, assign SYSTEM_ADMIN to admin user

apps/frontend/src/
├── auth/AuthContext.tsx          # existing — extend to carry roles/permissions from /auth/me
├── nav.ts                        # existing — add requiresPermission field to NavItem
├── pages/UsersPage.tsx           # new — per 02-UI-SPEC.md
└── pages/AuditLogPage.tsx        # new — per 02-UI-SPEC.md
```

### Pattern 1: `requirePermission(code)` — single-query permission derivation, no cross-request cache

**What:** A middleware that, given `req.userId` (already set by `requireAuth`), issues one Prisma query joining `User -> UserRole -> Role -> RolePermission -> Permission`, flattens the result into a `Set<string>` of permission codes, and checks membership. This query runs fresh on every request — nothing is cached in the JWT or in any server-side cache across requests, satisfying RBAC-06's "revoking a role takes effect on the very next request" requirement literally.

**When to use:** Every mutating route, composed directly after `requireAuth` in the middleware chain (`router.post("/", requireAuth, requirePermission("PRODUCT_CREATE"), createProduct)`).

**N+1 avoidance:** A naive implementation might query roles, then loop and query permissions per role — that's N+1. The nested `include` below does it in one round-trip regardless of how many roles a user has (typically 1-3). If a single request needs *multiple* `requirePermission` checks (uncommon — normally one per route), attach the computed permission set to `req` so a second check in the same request reuses it rather than re-querying; this is a per-request memoization, not a cross-request cache, so it does not violate RBAC-06.

**Example:**
```typescript
// apps/backend/src/middleware/permission.ts
import type { NextFunction, Response } from "express";
import { HttpError } from "./errorHandler.js";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedRequest } from "./auth.js";

export interface PermissionRequest extends AuthenticatedRequest {
  permissions?: Set<string>;
}

async function loadPermissions(userId: number): Promise<Set<string>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
      },
    },
  });
  const codes = new Set<string>();
  for (const ur of user?.userRoles ?? []) {
    for (const rp of ur.role.rolePermissions) {
      codes.add(rp.permission.permissionCode);
    }
  }
  return codes;
}

export function requirePermission(code: string) {
  return async (req: PermissionRequest, _res: Response, next: NextFunction) => {
    if (!req.userId) return next(new HttpError(401, "Not authenticated"));
    try {
      req.permissions ??= await loadPermissions(req.userId);
      if (!req.permissions.has(code)) {
        return next(new HttpError(403, "Insufficient permissions"));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
```
`[ASSUMED: query shape verified by reasoning about Prisma's nested-include semantics and the schema this research proposes — not run against a live database in this research pass; the planner/executor should confirm with a real query during Wave 1 implementation]`

### Pattern 2: Audit write inside the same `$transaction` as the mutation (resolves CONTEXT's "Claude's Discretion" item)

**What:** The audit write and the business mutation happen inside one `prisma.$transaction(async (tx) => {...})` block, opened at the **controller** layer (not buried inside each model, and not a separate Express middleware wrapping the route). Both succeed or both roll back — there is no window where a mutation is committed with no corresponding audit row, or vice versa.

**Why controller-level, not middleware:** An Express middleware wrapping the route (e.g., running *after* the route handler via `res.on("finish", ...)`) cannot participate in the same DB transaction as the handler's own writes — by the time `finish` fires, the handler's transaction has already committed or the response has already been sent. A **before-the-route** middleware can't know the "after" snapshot yet. Only code that has access to both the before-state and the post-mutation result — i.e., the controller/model layer itself — can build an accurate before/after pair and commit it atomically. This is why CONTEXT.md's own phrasing ("a single reusable audit-writing utility... called from every mutating controller") already points at the controller, not a middleware; this research confirms that's also the only transaction-safe option.

**Why this forces a model-layer refactor:** `importOrder.model.ts`, `salesOrder.model.ts`, and `stockTransaction.model.ts` already call `prisma.$transaction(...)` internally using the **singleton** `prisma` client. Prisma's interactive transactions cannot be nested — the `tx` object passed into a `$transaction` callback does not itself expose `$transaction`. If a controller opens its own transaction and then calls, e.g., `ImportOrderModel.create(...)`, that model function will try to open a **second, independent** transaction against the singleton client, which defeats atomicity with the audit write (two separate transactions, not one) and also risks lock contention/deadlock on the same rows within one request. The fix is mechanical but must be applied to every model with internal `$transaction` calls: accept an optional `Prisma.TransactionClient` parameter (defaulting to the singleton `prisma` for backward compatibility / non-audited call sites like `seed.ts`), and use that client throughout instead of always using the singleton.

**When to use:** Every controller action that creates, updates, deletes, approves, or rejects a business entity.

**Example:**
```typescript
// apps/backend/src/models/importOrder.model.ts — refactored signature
import type { PrismaClient, Prisma } from "@prisma/client";
type Client = PrismaClient | Prisma.TransactionClient;

export const ImportOrderModel = {
  // ...
  create: (data: {/* ... */}, client: Client = prisma) => {
    const rows = toItemRows(data.items);
    // NOTE: if `client` is already a tx (passed from a controller-level $transaction),
    // do NOT call client.$transaction again — just run the writes directly on `client`.
    // If `client` is the singleton `prisma`, it's safe to open a transaction here for
    // standalone (non-audited) callers like prisma/seed.ts.
    const run = async (tx: Client) => {
      const order = await tx.importOrder.create({
        data: { /* ...existing fields..., */ createdById: data.createdById },
        include: withRelations,
      });
      await createStockInTx(tx as Prisma.TransactionClient, data.orderNo, data.items);
      return order;
    };
    return "$transaction" in client ? client.$transaction((tx) => run(tx)) : run(client);
  },
};
```
```typescript
// apps/backend/src/lib/audit.ts
import type { Prisma } from "@prisma/client";

export const AuditLogModel = {
  record: (
    tx: Prisma.TransactionClient,
    params: { entity: string; entityId: number | string; action: string; userId: number | null; before: unknown; after: unknown },
  ) =>
    tx.auditLog.create({
      data: {
        entity: params.entity,
        entityId: String(params.entityId),
        action: params.action,
        userId: params.userId,
        before: params.before as Prisma.InputJsonValue | undefined,
        after: params.after as Prisma.InputJsonValue | undefined,
      },
    }),
};
```
```typescript
// apps/backend/src/controllers/importOrder.controller.ts — audited create
export const createImportOrder = asyncHandler(async (req, res) => {
  // ...existing body parsing...
  const order = await prisma.$transaction(async (tx) => {
    const created = await ImportOrderModel.create({ ...parsed, createdById: req.userId }, tx);
    await AuditLogModel.record(tx, {
      entity: "ImportOrder",
      entityId: created.importOrderId,
      action: "create",
      userId: req.userId ?? null,
      before: null,
      after: created,
    });
    return created;
  });
  res.status(201).json(order);
});
```
`[VERIFIED: Prisma interactive-transaction non-nesting behavior is documented Prisma Client behavior; the specific refactor shape (optional injectable client, conditional `$transaction` call) is a common, well-established pattern for this problem, cross-checked against the existing codebase's own `importOrder.model.ts`/`salesOrder.model.ts`/`stockTransaction.model.ts` transaction usage`]`

**Scope note for the planner:** Not every model needs this refactor with equal urgency — `category.model.ts`, `customer.model.ts`, `supplier.model.ts`, `license.model.ts` etc. currently do single plain `prisma.x.create()` calls with no internal transaction, so wrapping their controller calls in `prisma.$transaction(async (tx) => { const after = await tx.customer.create(data); await AuditLogModel.record(tx, {...}); return after; })` requires no model refactor at all — only the controller changes, calling `tx.customer.create` directly or having the model accept the same optional-client parameter for consistency. Only `importOrder.model.ts`, `salesOrder.model.ts`, and `stockTransaction.model.ts` (which already have internal `$transaction` calls) need the injectable-client refactor described above. Recommend applying the same optional-client signature convention to *all* models for consistency, even where not strictly required, so the audit-wrapping pattern in every controller looks identical.

### Pattern 3: Staged permission-enforcement rollout (mirrors Phase 1's D-08 / Pattern 3)

**What:** `requirePermission` is written once, then wired in progressively across the 11 existing route files plus the new ones, following the same "reads before writes" order Phase 1 used for `requireAuth`. Unlike Phase 1 (which had a single one-line global toggle because *all* routes needed the *same* check), this phase's checks are **route+method-specific** (different permission code per endpoint per the matrix in the role doc §7), so it cannot be a single-line change — it must be applied per route registration, but can still be staged wave-by-wave (e.g., "wire all `GET` list/detail routes in one wave using `*_VIEW` codes, then all `POST`/`PUT` in a following wave using `*_CREATE`/`*_EDIT` codes, then `DELETE`/approve/reject last").

**When to use:** Mandatory per CONTEXT.md's explicit instruction to mirror Phase 1's staged approach; also reduces risk of locking out the admin/other seeded users mid-rollout if role-permission seeding has a gap.

**Example:**
```typescript
// apps/backend/src/routes/product.routes.ts — after this phase
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

productRoutes.get("/", requireAuth, requirePermission("PRODUCT_VIEW"), listProducts);
productRoutes.get("/:id", requireAuth, requirePermission("PRODUCT_VIEW"), getProduct);
productRoutes.post("/", requireAuth, requirePermission("PRODUCT_CREATE"), createProduct);
productRoutes.put("/:id", requireAuth, requirePermission("PRODUCT_EDIT"), updateProduct);
productRoutes.delete("/:id", requireAuth, requirePermission("PRODUCT_DELETE"), deleteProduct);
```
**Critical ordering pitfall:** seed roles/permissions and assign `SYSTEM_ADMIN` to the `admin` user in the **same wave** the schema is created (Wave 1), *before* any `requirePermission` call is wired into a route (Wave 3+). If enforcement lands before the seed data exists, every request — including the admin's — gets 403'd with no recovery path short of a manual DB edit. This is the RBAC-equivalent of Phase 1's Pitfall 1 (big-bang cutover).

### Pattern 4: Self-lockout guard for `SYSTEM_ADMIN` (Claude's Discretion, resolved)

**What:** Before deactivating a user or removing their `SYSTEM_ADMIN` role assignment, count how many *other* active users currently hold `SYSTEM_ADMIN`. If the count would drop to zero, reject with a specific error (the UI-SPEC already names this: `user.toastLastAdminGuard` → "At least one active System Admin must remain. Assign System Admin to another user first.").

**When to use:** In `UserModel.deactivate()` and `UserModel.assignRoles()` (when a role list omits `SYSTEM_ADMIN` for a user who currently has it) — both paths must run the same check.

**Example:**
```typescript
// apps/backend/src/models/user.model.ts
async function assertNotLastAdmin(excludingUserId: number) {
  const count = await prisma.user.count({
    where: {
      status: "ACTIVE",
      id: { not: excludingUserId },
      userRoles: { some: { role: { roleCode: "SYSTEM_ADMIN" } } },
    },
  });
  if (count === 0) throw new HttpError(409, "At least one active System Admin must remain.");
}
```
`[ASSUMED: exact guard shape is this research's interpretation of CONTEXT.md's "reasonable judgment" instruction — the 409 status and exact trigger conditions (deactivate vs. role-removal) should be confirmed with the planner/user if ambiguity remains, but the UI-SPEC's toast copy strongly implies this is the expected behavior]`

### Anti-Patterns to Avoid
- **Caching the permission set anywhere that survives past the current request** (in-memory server cache keyed by userId, Redis, embedding in the JWT): directly violates RBAC-06's explicit requirement that a revoked role take effect on the user's very next request.
- **Wrapping `requirePermission` in the same wave as the RBAC schema/seed migration:** causes the same big-bang lockout risk Phase 1's Pitfall 1 describes — always seed roles/permissions/admin-assignment first, enforce later.
- **Opening a second `prisma.$transaction` inside a model already called from within a controller-level transaction:** Prisma will not merge them into one atomic unit — the model's internal transaction commits independently, defeating the audit-atomicity guarantee. Always thread the `tx` client through.
- **Building the audit log as a soft-delete-capable table (an `isDeleted`/`deletedAt` column) "just in case":** contradicts AUDIT-03's append-only requirement; the correct enforcement is "no route exists," not a flag that could theoretically be flipped later.
- **Restricting the generic `PUT /:id` update endpoint's `approver`/`status` writes in the same commit as adding the dedicated approve/reject endpoints, without first confirming test coverage:** confirmed safe in this research pass (see Common Pitfalls) but still sequence it as its own reviewable change.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Many-to-many role/permission storage | A single `role` string column on `User` with hand-parsed comma-separated permission lists | Proper join tables (`UserRole`, `RolePermission`) exactly as specified in the role doc §5 | RBAC-02/RBAC-03 require true multi-role-per-user with union semantics; a string column can't express this cleanly and makes revocation/auditing of role changes much harder |
| Audit-log atomicity | A `try { mutate } catch { logFailure }` pattern with a background retry queue for the audit write | `prisma.$transaction` — both writes commit or roll back together | A background retry queue for a compliance-relevant audit trail is significant, unnecessary complexity; Prisma's transaction primitive already gives atomicity for free within a single request |
| Permission-set union computation | Hand-written SQL joins or multiple round-trip queries per role | A single Prisma nested `include` query (Pattern 1) | Prisma's query builder already generates the correct JOIN; hand-written SQL bypasses type safety and risks the exact N+1 pattern CONTEXT.md flagged as a concern |
| Random/secure IDs for audit entries | Custom ID scheme | Existing `@id @default(autoincrement())` convention (matches every other table in this schema) | No requirement calls for anything other than the project's established auto-increment PK convention; introducing a new ID scheme (UUID, etc.) for just this one table breaks consistency for no benefit |

**Key insight:** Every piece of this phase that touches data integrity (transaction atomicity, many-to-many relational modeling) has a direct, idiomatic Prisma feature already available — the actual engineering effort in this phase is *sequencing* (seed before enforce) and *plumbing* (threading a `tx` client through models that didn't need one before), not inventing new mechanisms.

## Common Pitfalls

### Pitfall 1: `ImportOrder`/`SalesOrder` have no `createdBy`/`userId` field — D-01's no-self-approval rule cannot be implemented without a schema addition

**What goes wrong:** CONTEXT.md D-01 requires the new approve/reject endpoints to "enforce no-self-approval: reject if the requesting user is the order's `createdBy`/original creator." Direct inspection of `apps/backend/prisma/schema.prisma` (current state) shows `ImportOrder` has fields `importOrderId, orderNo, supplierId, country, incoterms, orderDate, etaDate, skuItemCount, totalValue, status, approver, customsEntryNo` — no `createdById` or equivalent. `SalesOrder` similarly has no creator-attribution field. (For contrast, `CustomerLicense` *does* already have `createdBy`/`updatedBy` string columns, showing the project has a precedent for this pattern but didn't apply it to orders.) Without this field, "reject if requester is the creator" has nothing to compare against.

**Why it happens:** These order models predate authentication (Phase 1) entirely — they were built when there was no concept of "who created this."

**How to avoid:** Add `createdById Int?` (nullable, since Phase 1/pre-migration historical rows and `seed.ts`'s three model-layer demo records have no real authenticated creator) with a relation to `User`, to both `ImportOrder` and `SalesOrder`, in this phase's migration. Update every create call site — `importOrder.controller.ts`'s `createImportOrder`, `salesOrder.controller.ts`'s `createSalesOrder`, and the three `ImportOrderModel.create()`/`SalesOrderModel.create()` calls in `prisma/seed.ts` — to pass `createdById: req.userId` (controllers) or leave it `null`/assign to the seeded admin (seed script, since it runs outside a request context).

**Warning signs:** Any plan task that implements the approve/reject endpoints' no-self-approval check without first confirming a `createdById` column exists.

`[VERIFIED: apps/backend/prisma/schema.prisma direct inspection, 2026-09-03]`

### Pitfall 2: Prisma interactive transactions cannot be nested — controller-level audit atomicity breaks silently for order/stock-transaction models

**What goes wrong:** As detailed in Architecture Pattern 2, `importOrder.model.ts`, `salesOrder.model.ts`, and `stockTransaction.model.ts` already call `prisma.$transaction(...)` internally on the singleton client. If a controller wraps a call to, e.g., `ImportOrderModel.create()` in its *own* `prisma.$transaction`, the model's internal `prisma.$transaction` call opens a **second**, unrelated transaction — it does not join the outer one. This doesn't throw an error (so it's easy to miss in code review) — it just silently produces two independent transactions instead of one atomic unit, meaning a crash between the two could commit the mutation without the audit row, exactly the failure mode this phase is meant to prevent.

**Why it happens:** Prisma's interactive-transaction API (`prisma.$transaction(async (tx) => {...})`) hands the callback a `Prisma.TransactionClient`, which intentionally does not itself expose a `$transaction` method — but nothing stops code inside that callback from importing and calling the *original* `prisma` singleton's `$transaction` instead, which does still exist and will happily open a new, separate transaction against the same database connection pool.

**How to avoid:** Refactor `ImportOrderModel`, `SalesOrderModel`, and `StockTransactionModel`'s mutation methods to accept an optional `client: PrismaClient | Prisma.TransactionClient = prisma` parameter and use that client (not the imported singleton) for every internal query, only opening a `$transaction` when the passed-in client is the plain singleton (i.e., when called standalone, e.g., from `seed.ts`). See the code example in Pattern 2.

**Warning signs:** Any test that asserts "if the audit write fails, the business mutation rolls back too" (or vice versa) fails intermittently or the mutation succeeds with no matching `AuditLog` row.

`[VERIFIED: direct inspection of apps/backend/src/models/importOrder.model.ts, salesOrder.model.ts (via schema/controller review), stockTransaction.model.ts usage in importOrder.model.ts, cross-checked against documented Prisma interactive-transaction non-nesting behavior]`

### Pitfall 3: Restricting the generic `PUT /:id` endpoint's `approver`/`status` writes — confirmed safe, no existing test coverage to break

**What goes wrong (if not researched):** CONTEXT.md flagged this as needing confirmation before acting — the risk being that some existing test exercises the generic update endpoint's ability to set `approver`/`status` to "approved"/"rejected," and restricting it would break that test.

**Investigation result:** `apps/backend/tests/` currently contains only 8 files, all auth-related (`auth.cors.test.ts`, `auth.enforcement.test.ts`, `auth.hashing.test.ts`, `auth.login.test.ts`, `auth.logout.test.ts`, `auth.rateLimit.test.ts`, `auth.refresh.test.ts`, `middleware.auth.test.ts`) plus `fixtures/testUser.ts` and `setup.ts`. There are zero tests referencing `importOrder`/`salesOrder` update behavior, `approver`, or `status` field writes at all — Phase 1 only shipped auth tests. **This means it is safe to restrict the generic update endpoint's handling of `approver`/`status` transitions to "approved"/"rejected" without breaking any existing automated test.** The planner should still add a *new* test in this phase asserting the generic update endpoint rejects (or ignores) attempts to set status to approved/rejected once the dedicated endpoints exist, to lock in the intended behavior going forward.

**Warning signs:** N/A — this is a resolved finding, not an open risk.

`[VERIFIED: apps/backend/tests/ directory listing + grep for "approver"/"status" across all test files, 2026-09-03 — zero matches outside the auth suite]`

### Pitfall 4: MySQL `Json` column + Prisma `Decimal`/`Date` fields in audit snapshots need explicit serialization

**What goes wrong:** Several existing models have `Decimal` fields (e.g., `Product.unitPrice`, `ImportOrder.totalValue`, `SalesOrder.netValue`) and `Date`/`DateTime` fields. Prisma's `Decimal` type (backed by `decimal.js`) and `Date` objects are not always what a naive `JSON.stringify()` or direct assignment to a Prisma `Json` field expects — passing a raw Prisma query result object (which contains `Decimal` instances) directly as the `before`/`after` value to a `Json` column can throw or silently produce unexpected serialization (e.g., `Decimal` objects do have a `toJSON()` that stringifies them, and `Date` serializes to ISO string via its own `toJSON()`, so `JSON.parse(JSON.stringify(record))` round-trips safely) — but assigning the object directly without going through `JSON.stringify`/`JSON.parse` first, relying on Prisma's `Prisma.InputJsonValue` typing to "just work," can produce a TypeScript type error or, worse, an object Prisma's query engine doesn't serialize the way you expect for nested `Decimal`/`Date` values.

**Why it happens:** `Decimal` and `Date` are not plain JSON-serializable types in JavaScript's structural sense — they only become JSON-safe via their `toJSON()` methods, which only get invoked automatically inside an actual `JSON.stringify()` call, not during Prisma's own JS-to-`Json`-column marshaling.

**How to avoid:** In `AuditLogModel.record`, explicitly normalize `before`/`after` via `JSON.parse(JSON.stringify(value))` before passing to Prisma, guaranteeing every `Decimal`/`Date`/nested-relation value becomes a plain, JSON-safe structure regardless of Prisma's own typing. This is cheap (audit rows are not a hot path) and removes the ambiguity entirely.

**Warning signs:** A `Decimal` value appearing in a stored audit row's JSON as `{"s":1,"e":3,"d":[1234]}` (decimal.js's internal representation) instead of a plain number/string — a sign the normalization step was skipped.

`[ASSUMED: based on general Prisma + decimal.js serialization behavior knowledge — not run against a live query in this research pass; recommend the planner add a small unit test asserting a `Decimal` field round-trips as a plain string/number in a stored `AuditLog.before`/`after` value]`

### Pitfall 5: Windows/Node 20.19.0 native-binding risk — none expected this phase, but confirm no new native deps sneak in

**What goes wrong (Phase 1 precedent):** Phase 1's research and implementation discovered `argon2` (the pure-JS-wrapper-over-native-binding package) segfaulted on this Windows/Node 20.19.0 environment, and had to be substituted with `@node-rs/argon2` (a Rust-based native binding with confirmed prebuilt Windows binaries). This phase reuses that already-fixed dependency for any new password-hashing needs (User Management's "create user" flow) — no new native-binding package is introduced by this phase's own requirements (RBAC schema, audit logging, and permission middleware are pure Prisma/Express/TypeScript, no cryptographic native code).

**Confirmed safe for this phase:** No new npm packages are recommended in the Standard Stack section above — everything needed is already installed and already validated on this environment from Phase 1. The only Windows-relevant risk would be introduced if the planner chooses to add a new package this research didn't anticipate (e.g., a CSV/PDF export library, which is explicitly out of scope until Phase 6).

**Warning signs:** Any plan task that proposes `pnpm add` for a package not listed in Standard Stack above should trigger a check of that package's native-binding requirements against Windows/Node 20.19.0 before being added to a plan.

`[CITED: 01-RESEARCH.md Common Pitfalls / Standard Stack — @node-rs/argon2 substitution already applied and verified in package.json]`

### Pitfall 6: Permission-check test explosion (many role × route × method combinations)

**What goes wrong:** With ~19 modules × up to 5 HTTP methods × 6 roles, a naive one-`it()`-per-combination test suite would run into the hundreds of near-identical test cases, mostly duplicated boilerplate (login as role X, call route Y, assert status).

**Why it happens:** Comprehensive permission-denial coverage is genuinely valuable (it's the actual thing RBAC-04 needs to prove), but hand-writing each case doesn't scale.

**How to avoid:** Use `it.each`/`describe.each` (vitest supports both, same API as Jest) to define a small, explicit table of `{ method, path, requiredPermission, roleWithPermission, roleWithoutPermission }` rows per module, and let one parameterized test body iterate them — this keeps the *data* (which role needs which permission for which route) readable and reviewable as a table, while the *test logic* (login, call, assert 200 vs 403) is written once. Pair this with a `createTestUserWithRole(roleCode)` fixture extending the existing `createTestUser` in `tests/fixtures/testUser.ts` (which currently creates a user with no role at all — will need a role-assignment step added).

**Warning signs:** A test file with more than ~30 lines of near-identical `it(...)` blocks differing only in role/route/expected-status literals.

`[VERIFIED: existing test pattern inspected in apps/backend/tests/auth.enforcement.test.ts and tests/fixtures/testUser.ts — confirms the fixture-based login-then-request pattern this recommendation extends; it.each availability confirmed via installed vitest@2.1.8, which has supported it.each/describe.each since early 0.x]`

## Code Examples

### Prisma schema additions (additive migration)
```prisma
// Source: liquor-system-basic-role-permission-recommendation.md §5, adapted to Prisma conventions
// matching this codebase's existing @map/@@map snake_case DB-naming style

model Role {
  roleId          Int              @id @default(autoincrement()) @map("role_id")
  roleCode        String           @unique @map("role_code")
  roleName        String           @map("role_name")
  userRoles       UserRole[]
  rolePermissions RolePermission[]

  @@map("roles")
}

model Permission {
  permissionId     Int              @id @default(autoincrement()) @map("permission_id")
  permissionCode   String           @unique @map("permission_code")
  permissionName   String           @map("permission_name")
  rolePermissions  RolePermission[]

  @@map("permissions")
}

model UserRole {
  userId Int  @map("user_id")
  roleId Int  @map("role_id")
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  role   Role @relation(fields: [roleId], references: [roleId], onDelete: Cascade)

  @@id([userId, roleId])
  @@map("user_roles")
}

model RolePermission {
  roleId       Int        @map("role_id")
  permissionId Int        @map("permission_id")
  role         Role       @relation(fields: [roleId], references: [roleId], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [permissionId], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model AuditLog {
  auditLogId Int      @id @default(autoincrement()) @map("audit_log_id")
  entity     String
  entityId   String   @map("entity_id")
  action     String   // "create" | "update" | "delete" | "login" | "logout" | "approve" | "reject" | "export"
  userId     Int?     @map("user_id")
  before     Json?
  after      Json?
  createdAt  DateTime @default(now()) @map("created_at")

  user User? @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([entity, entityId])
  @@index([userId])
  @@index([action])
  @@index([createdAt])
  @@map("audit_logs")
}

// Extend existing User model:
model User {
  // ...existing fields unchanged...
  userRoles  UserRole[]
  auditLogs  AuditLog[]
}

// Extend existing ImportOrder / SalesOrder models (Pitfall 1):
model ImportOrder {
  // ...existing fields unchanged...
  createdById Int?  @map("created_by_id")
  createdBy   User? @relation(fields: [createdById], references: [id], onDelete: SetNull)
}
model SalesOrder {
  // ...existing fields unchanged...
  createdById Int?  @map("created_by_id")
  createdBy   User? @relation(fields: [createdById], references: [id], onDelete: SetNull)
}
```
`[VERIFIED: additive-only, no changes to any existing column/constraint; naming convention matches apps/backend/prisma/schema.prisma's existing @map/@@map style exactly]`

### Approve endpoint with no-self-approval + permission + audit (RBAC-04, AUDIT-02, D-01)
```typescript
// apps/backend/src/controllers/importOrder.controller.ts — new handler
export const approveImportOrder = asyncHandler(async (req, res) => {
  const importOrderId = Number(req.params.id);
  const order = await prisma.$transaction(async (tx) => {
    const existing = await tx.importOrder.findUnique({ where: { importOrderId } });
    if (!existing) throw new HttpError(404, "Import order not found");
    if (existing.createdById != null && existing.createdById === req.userId) {
      throw new HttpError(403, "You cannot approve an order you created");
    }
    const updated = await tx.importOrder.update({
      where: { importOrderId },
      data: { status: "APPROVED", approver: req.username },
    });
    await AuditLogModel.record(tx, {
      entity: "ImportOrder",
      entityId: importOrderId,
      action: "approve",
      userId: req.userId ?? null,
      before: existing,
      after: updated,
    });
    return updated;
  });
  res.json(order);
});
```
```typescript
// apps/backend/src/routes/importOrder.routes.ts — new route wiring
importOrderRoutes.post(
  "/:id/approve",
  requireAuth,
  requirePermission("IMPORT_ORDER_APPROVE"),
  approveImportOrder,
);
```

### Audit log query endpoint (AUDIT-04)
```typescript
// apps/backend/src/controllers/auditLog.controller.ts
import { z } from "zod";

const filterSchema = z.object({
  entity: z.string().optional(),
  userId: z.coerce.number().int().optional(),
  action: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const listAuditLogs = asyncHandler(async (req, res) => {
  const { entity, userId, action, from, to } = filterSchema.parse(req.query);
  const logs = await prisma.auditLog.findMany({
    where: {
      entity,
      userId,
      action,
      createdAt: from || to ? { gte: from, lte: to } : undefined,
    },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, username: true } } },
  });
  res.json(logs);
});
```
```typescript
// apps/backend/src/routes/auditLog.routes.ts — GET only, AUDIT-03 enforced by omission
export const auditLogRoutes = Router();
auditLogRoutes.get("/", requireAuth, requirePermission("AUDIT_LOG_VIEW"), listAuditLogs);
// Deliberately no POST/PUT/DELETE route registered on this router, ever.
```

### `login`/`logout` audit events (AUDIT-02)
```typescript
// apps/backend/src/controllers/auth.controller.ts — extend existing login handler
// after successful login, before res.json(...):
await AuditLogModel.record(prisma, {
  entity: "User",
  entityId: user.id,
  action: "login",
  userId: user.id,
  before: null,
  after: { username: user.username },
});
```
Note: `AuditLogModel.record` should accept either `PrismaClient` or `Prisma.TransactionClient` (both implement `.auditLog.create`), so login/logout — which don't need to be paired with another mutation in one transaction — can call it directly against the singleton `prisma`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Role stored as a single string/enum on `User` | Normalized `Role`/`Permission`/`UserRole`/`RolePermission` join tables | Long-standing RBAC best practice, reaffirmed by this project's own role doc §5 | Enables true multi-role-per-user (RBAC-02) and independent permission-set evolution without touching the `User` table |
| Permissions baked into JWT for stateless checks | Permissions re-derived from DB per request | Consistently recommended in 2025-2026 Node/Express auth guides for any system needing instant revocation | Directly required by RBAC-06; trades a small per-request query cost for correctness (revocation latency = 0 instead of = token TTL) |
| Audit trail as scattered `console.log`/ad-hoc fields (`approver` string) | Centralized, generic `AuditLog` table with structured before/after JSON | This phase's own mandate (AUDIT-01 through AUDIT-04) | Replaces the current `ImportOrder.approver`/`SalesOrder.approver` free-text field's implicit "audit trail" with a real, queryable, append-only log |

**Deprecated/outdated:**
- The current `approver` free-text field on `ImportOrder`/`SalesOrder` as the *only* record of who approved an order: not removed in this phase (Phase 4 owns the full status-machine redesign), but its role is downgraded — the `AuditLog` table becomes the authoritative accountability record going forward, with `approver` continuing to exist for display convenience only.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The exact `requirePermission` query shape (nested Prisma `include` from `User` through to `Permission`) is correct and performant as written | Architecture Pattern 1 | Low-Medium — not run against a live database in this research pass; if the nested include syntax needs adjustment, it's a mechanical fix during Wave 1 TDD, not an architectural change |
| A2 | The self-lockout guard should trigger on both "deactivate user" and "remove SYSTEM_ADMIN role from user" actions, with a 409 status | Architecture Pattern 4 | Low — CONTEXT.md explicitly left this to discretion; UI-SPEC's toast copy corroborates the general shape, but exact HTTP status/trigger conditions could reasonably differ without breaking any stated requirement |
| A3 | `Decimal`/`Date` fields in audit before/after snapshots need explicit `JSON.parse(JSON.stringify(...))` normalization before being passed to Prisma's `Json` column type | Common Pitfalls (Pitfall 4) | Low — worst case is a TypeScript type friction point or slightly malformed JSON in a low-traffic audit table; doesn't block core functionality, but should be verified with a real test during implementation |
| A4 | `createdById` should be nullable (`Int?`) rather than required, to accommodate `seed.ts`'s model-layer demo records and any pre-migration historical data | Common Pitfalls (Pitfall 1), Code Examples | Low — if made required instead, `seed.ts`'s three model-layer calls need an explicit admin-user ID passed, which is a minor seed-script change either way; nullable is the safer default and doesn't block the no-self-approval check (a null `createdById` simply never matches `req.userId`, so it fails open toward "approval allowed," which is the pre-existing behavior anyway) |
| A5 | Permission codes should be seeded directly and only from the role doc §7 matrix (~40-60 codes across ~19 modules), with no additional codes invented for this phase's own new UI surfaces (e.g., no separate "AUDIT_LOG_EXPORT" code since AUDIT-04 doesn't require exporting the audit log itself) | Standard Stack, Code Examples | Low — `AUDIT_LOG_VIEW` is a reasonable minimal addition beyond the literal matrix (which lists "Audit Logs: V / V / Own-Related..." without a machine-readable code) since D-04 restricts audit-log access to two specific roles; the planner should confirm the exact permission-code list against the matrix during Wave 1's seed-writing task, not assume this research's naming is final |

**If this table is empty:** N/A — see rows above.

## Open Questions

1. **Should `requirePermission("AUDIT_LOG_VIEW")` be a real permission-code row assigned to `SYSTEM_ADMIN` and `MANAGER_APPROVER` in `role_permissions`, or should audit-log access be a hardcoded role-code check (`req.userId`'s roles include `SYSTEM_ADMIN` or `MANAGER_APPROVER`) bypassing the permission table entirely?**
   - What we know: D-04 specifies binary access by role, not by a granular permission — this reads more like a role check than a permission check.
   - What's unclear: Whether introducing one hardcoded role-name check breaks the "everything flows through `requirePermission`" consistency this phase otherwise establishes.
   - Recommendation: Model it as a permission code (`AUDIT_LOG_VIEW`) assigned only to those two roles in the seed data — keeps `requirePermission` as the single enforcement mechanism everywhere, with no special-cased role-name check anywhere in the codebase, and if D-04's "Own/Related" scoping is added in a future phase, the permission-table approach extends cleanly (e.g., add `AUDIT_LOG_VIEW_OWN` for other roles later) without touching the middleware.

2. **Exact permission-code list (40-60 codes across ~19 modules) — this research proposes the shape but not the final enumerated list.**
   - What we know: The role doc §7 matrix gives module × role → access-level pairs (V/C/E/A/X/-), which maps naturally to codes like `{MODULE}_{VIEW|CREATE|EDIT|APPROVE}` and `{MODULE}_FULL` for admin-only modules (User Management, Role Management).
   - What's unclear: Some matrix cells combine multiple access levels in one cell (e.g., "V/A" for Import Order under Manager) — whether that means two separate permission codes (`IMPORT_ORDER_VIEW` + `IMPORT_ORDER_APPROVE`) both assigned to that role, or a single combined code.
   - Recommendation: Always split into atomic single-action codes (`IMPORT_ORDER_VIEW`, `IMPORT_ORDER_APPROVE` as two separate rows, both assigned to `MANAGER_APPROVER`) — this is more flexible for future per-action permission changes and matches D-02's stated granularity ("module + action level"). The planner should enumerate the full list as an explicit Wave 1 seed-data task, deriving it mechanically from the §7 matrix rather than this research attempting to write all ~50 rows by hand (high risk of transcription error against the source document).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| MySQL | `Json` column type for `AuditLog.before`/`after` | Yes — existing `DATABASE_URL`-configured DB from Phase 1 | 5.7+/8.0 (per Phase 1 research, unchanged) | None needed — `Json` scalar supported since MySQL 5.7.8, already the project's floor version |
| Prisma CLI (`prisma migrate dev` / `db push`) | Applying the additive schema changes | Yes — already used for 6 prior migrations in `apps/backend/prisma/migrations/` | 6.4.1 (project-pinned) | None needed |
| `@node-rs/argon2` | User-management "create user" password hashing | Yes — installed and validated on this Windows/Node 20.19.0 environment since Phase 1 | 2.2.0 | Already the fallback from the original `argon2` native-binding failure; no further fallback needed |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — this phase introduces zero new runtime dependencies.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `vitest` 2.1.8 + `supertest` 7.0.0 (installed, Phase 1) |
| Config file | `apps/backend/vitest.config.ts` — `fileParallelism: false`, `setupFiles: ["./tests/setup.ts"]` (unchanged, carry forward per CONTEXT.md's explicit instruction) |
| Quick run command | `pnpm --filter backend exec vitest run <file>` |
| Full suite command | `pnpm --filter backend exec vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RBAC-01 | Seed creates exactly the 6 defined roles with correct codes | unit/integration | `vitest run tests/rbac.seed.test.ts` | ❌ Wave 0 |
| RBAC-02 | A user can be assigned 2+ roles simultaneously; both persist | integration | `vitest run tests/rbac.userRoles.test.ts` | ❌ Wave 0 |
| RBAC-03 | Effective permissions = union across all assigned roles (test a user with 2 roles whose combined permission set exceeds either role alone) | integration | `vitest run tests/rbac.permissionUnion.test.ts` | ❌ Wave 0 |
| RBAC-04 | A user without `PRODUCT_CREATE` gets 403 on `POST /api/products`; a user with it gets 201 | integration, `it.each` table per Pitfall 6 | `vitest run tests/rbac.enforcement.test.ts` | ❌ Wave 0 |
| RBAC-05 | Admin creates/edits/deactivates/reactivates a user and assigns roles; non-admin gets 403 on all of these | integration | `vitest run tests/user.management.test.ts` | ❌ Wave 0 |
| RBAC-06 | Revoking a role mid-session (no new login) causes the next request with the same access token to be denied | integration | `vitest run tests/rbac.revocation.test.ts` | ❌ Wave 0 |
| AUDIT-01 | Create/update/delete on a sample entity (e.g., Product) produces a matching `AuditLog` row with correct before/after JSON | integration | `vitest run tests/audit.crud.test.ts` | ❌ Wave 0 |
| AUDIT-02 | Login, logout, approve, reject each produce a distinct `AuditLog` row with the correct `action` value | integration | `vitest run tests/audit.actions.test.ts` | ❌ Wave 0 |
| AUDIT-03 | No route exists for `PUT`/`DELETE` `/api/audit-logs/*` (expect 404, not 403 — the route itself must not exist) | integration | `vitest run tests/audit.immutable.test.ts` | ❌ Wave 0 |
| AUDIT-04 | `GET /api/audit-logs` filters correctly by entity, user, action, and date range; a `SALES_OFFICER` gets 403, `MANAGER_APPROVER` gets 200 | integration | `vitest run tests/audit.query.test.ts` | ❌ Wave 0 |
| D-01 (self-approval) | The order's creator gets 403 on `/approve`/`/reject` for their own order; a different user with the approve permission gets 200 | integration | `vitest run tests/order.noSelfApproval.test.ts` | ❌ Wave 0 |
| Audit atomicity (Pitfall 2) | A forced failure mid-transaction (e.g., invalid FK) rolls back both the mutation and the audit row — assert neither persists | integration | `vitest run tests/audit.atomicity.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** targeted `vitest run <file>` for the RBAC/audit test just written/touched
- **Per wave merge:** `pnpm --filter backend exec vitest run` (full backend suite, including all Phase 1 auth tests — regression check that RBAC didn't break auth)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/rbac.seed.test.ts`, `tests/rbac.userRoles.test.ts`, `tests/rbac.permissionUnion.test.ts`, `tests/rbac.enforcement.test.ts`, `tests/rbac.revocation.test.ts` — net-new, RBAC-01 through RBAC-06
- [ ] `tests/user.management.test.ts` — net-new, RBAC-05 + self-lockout guard
- [ ] `tests/audit.crud.test.ts`, `tests/audit.actions.test.ts`, `tests/audit.immutable.test.ts`, `tests/audit.query.test.ts`, `tests/audit.atomicity.test.ts` — net-new, AUDIT-01 through AUDIT-04 + transaction-safety
- [ ] `tests/order.noSelfApproval.test.ts` — net-new, D-01
- [ ] Extend `tests/fixtures/testUser.ts`'s `createTestUser` with a `createTestUserWithRole(roleCode, suffix)` variant that also inserts the corresponding `UserRole` row, to support the `it.each` role-matrix tests (Pitfall 6) without duplicating setup code
- [ ] No new test framework/config needed — Phase 1's `vitest.config.ts` (`fileParallelism: false`, shared `setup.ts`) is already correctly configured and must be carried forward unchanged

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-------------------|
| V2 Authentication | no (unchanged from Phase 1) | Already covered by Phase 1's `requireAuth`; this phase adds authorization on top, not new authentication mechanisms |
| V3 Session Management | no (unchanged from Phase 1) | No session-shape changes in this phase — JWT payload stays `{userId}` only, per RBAC-06 |
| V4 Access Control | yes — this is this phase's core concern | `requirePermission` middleware, DB-derived per request (never trust client-supplied role/permission claims); no client-side-only enforcement anywhere (mirrors PROJECT.md's core value statement) |
| V5 Input Validation | yes | `zod` schemas for new endpoint bodies: user create/edit (username, password, roleIds array), approve/reject (optional rejection reason), audit-log filter query params (entity/userId/action/date range) — extend the pattern already used in Phase 1's auth routes |
| V6 Cryptography | yes (reused, not new) | New-user password hashing reuses `@node-rs/argon2` exactly as Phase 1 established — no new cryptographic code introduced by this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation via direct API call bypassing hidden UI buttons | Elevation of Privilege | `requirePermission` on every mutating route, independent of any frontend state — this is literally RBAC-04's requirement and this project's core value statement |
| Stale-permission exploitation (continuing to act on a revoked role using an old access token) | Elevation of Privilege | RBAC-06's DB-re-derivation-per-request design directly closes this window — worst case exposure is zero requests after revocation, not "until token expiry" |
| Self-approval to bypass financial/compliance controls | Repudiation / Tampering | D-01's explicit `createdById !== req.userId` check on approve/reject, backed by the role doc §4's "important control rules" |
| Audit log tampering to hide unauthorized actions | Repudiation | AUDIT-03 enforced by never registering a PUT/DELETE route for `/api/audit-logs` — a deliberate architectural choice, not a DB-level immutability guarantee (MySQL has no native row-immutability feature at this project's scale); document this as an accepted trust boundary, not a false claim of cryptographic tamper-evidence |
| IDOR on `/api/audit-logs?userId=X` allowing a lower-privilege user to view another user's actions | Information Disclosure | Access to the entire audit-log endpoint is gated by role (D-04: `SYSTEM_ADMIN`/`MANAGER_APPROVER` only) rather than per-row ownership filtering — this is the accepted scope simplification per D-04, not a gap, since no role below Manager can reach the endpoint at all in this phase |
| Mass-assignment on user-role-update endpoint (client sends arbitrary `roleIds` including ones the caller shouldn't be able to grant) | Elevation of Privilege | Only `SYSTEM_ADMIN`-permitted callers can reach the role-assignment endpoint at all (`requirePermission("USER_MANAGEMENT_FULL")`); still validate the submitted `roleIds` array against the known 6 role codes via `zod` rather than trusting arbitrary integers |

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection: `apps/backend/prisma/schema.prisma`, `apps/backend/src/middleware/auth.ts`, `apps/backend/src/middleware/errorHandler.ts`, `apps/backend/src/routes/index.ts`, `apps/backend/src/routes/importOrder.routes.ts`, `apps/backend/src/controllers/importOrder.controller.ts`, `apps/backend/src/models/importOrder.model.ts`, `apps/backend/src/models/customer.model.ts`, `apps/backend/src/app.ts`, `apps/backend/prisma/seed.ts`, `apps/backend/tests/*` (all 8 files + fixtures), `apps/backend/vitest.config.ts`, `apps/backend/package.json`, `apps/backend/prisma/migrations/` directory listing — confirms current schema shape (no `createdBy` on orders), existing `$transaction` usage patterns, existing test coverage gaps, installed dependency versions
- `.planning/phases/02-rbac-audit-logging/02-CONTEXT.md` — locked decisions and discretion areas
- `.planning/phases/02-rbac-audit-logging/02-UI-SPEC.md` — approved UI contract, confirms frontend data requirements (roles/permissions on `AuthContext`, nav-gating field)
- `.planning/phases/01-authentication/01-RESEARCH.md` — staged-rollout precedent, `@node-rs/argon2` substitution history, existing test infrastructure baseline
- `liquor-system-basic-role-permission-recommendation.md` — authoritative role/permission/schema design (§5-9)
- `liquor-system-improvement-advice.md` §6 — requirements/acceptance-criteria source for AUDIT-01 through AUDIT-04
- Live `npm view <pkg> version` registry queries (`prisma`, `@prisma/client`) — confirms current registry versions vs. this project's pinned versions, 2026-09-03

### Secondary (MEDIUM confidence)
- Prisma interactive-transaction non-nesting behavior — well-established, widely documented Prisma Client behavior; not independently re-verified against a live query in this research pass, but consistent with the existing codebase's own transaction usage patterns and standard Prisma documentation knowledge

### Tertiary (LOW confidence)
- Exact `requirePermission` nested-`include` query syntax (Pattern 1) and the `Decimal`/`Date` JSON-serialization recommendation (Pitfall 4) — reasoned from training knowledge of Prisma's query API and decimal.js/Date `toJSON()` semantics, not executed against this project's live database in this research pass; both are flagged `[ASSUMED]` in their respective sections and should be confirmed with a real query/test during Wave 1 implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every existing dependency's version and Windows-compatibility status directly reused from Phase 1's already-verified findings
- Architecture: HIGH — RBAC schema shape is directly specified by the project's own authoritative role doc; transaction-safety pattern is derived from direct inspection of this exact codebase's existing model-layer conventions, not a generic external recommendation
- Pitfalls: HIGH — the two most consequential findings (missing `createdById` field, transaction-nesting risk) are both confirmed by direct codebase inspection, not inference; the two `[ASSUMED]` items (exact query syntax, Decimal serialization) are narrow, mechanical implementation details flagged for Wave 1 verification, not architectural uncertainty

**Research date:** 2026-09-03
**Valid until:** 2026-10-03 (30 days — stable ecosystem, no fast-moving dependencies; re-verify sooner only if Prisma is upgraded mid-milestone)
