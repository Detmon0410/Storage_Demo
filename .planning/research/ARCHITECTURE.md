# Architecture Research

**Domain:** Production-readiness additions (auth/RBAC, audit logging, lot/batch inventory, approval workflow) to an existing layered Express + Prisma + MySQL / React + Vite liquor trading system
**Researched:** 2026-09-03
**Confidence:** HIGH (patterns verified against existing codebase conventions + current Prisma/Express ecosystem docs)

## Standard Architecture

### System Overview

The existing system is a clean three-layer backend (Route → Controller → Model/Prisma) with a stateless server and a React frontend using resource hooks. The four new capability areas are **cross-cutting additions that slot into this existing pipeline rather than parallel systems**. None of them require a new architectural style — they extend the request lifecycle and the data model.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ FRONTEND (React/Vite) — unchanged shape, new concerns layered in         │
│  AuthProvider (token/user context) → useResource/useAuthedFetch          │
│  → Pages gated by <RequirePermission> → existing DataTable/Modal UI      │
└───────────────────────────────┬────────────────────────────────────────┘
                                 │ Authorization: Bearer <JWT>
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ EXPRESS MIDDLEWARE CHAIN (new layer, runs before existing routes)         │
│  cors → json-parser → [authenticate] → [attachUser+roles] →             │
│  routes/index.ts → [requirePermission(code)] (per-route) → controller    │
│                                          ↓                                │
│                              [auditCapture — wraps response]             │
└───────────────────────────────┬────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ CONTROLLERS (existing layer, extended)                                   │
│  - Read req.user (id, roles, permissions) set by auth middleware         │
│  - Pass actingUserId into model calls for created_by/approved_by/audit   │
│  - Reject with 403 HttpError if model throws business-rule violation     │
└───────────────────────────────┬────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ MODELS (existing layer, extended — business rules + state machines live  │
│ here, NOT in controllers)                                                │
│  - SalesOrderModel: license check, stock/lot check, credit/discount      │
│    check, approval-status transition guard, self-approval guard          │
│  - InventoryStockModel (new): lot decrement/restore, product-stock sync  │
│  - ApprovalModel (new, shared helper): generic status transition + audit │
│  - AuditLogModel (new): append-only writes, called from other models     │
│    or via Prisma extension                                               │
└───────────────────────────────┬────────────────────────────────────────┘
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ PRISMA / MYSQL (persistence layer, extended schema)                      │
│  users, roles, user_roles, permissions, role_permissions (new)           │
│  audit_logs (new, append-only)                                           │
│  inventory_stock / stock_transactions (lot fields added/enforced)        │
│  approval fields added to import_orders / sales_orders                  │
│  Prisma Client Extension ($extends) or explicit model-layer calls        │
│  for audit-log capture on writes                                        │
└──────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `authenticate` middleware | Verify JWT, reject missing/invalid/expired tokens with 401 | New `apps/backend/src/middleware/auth.ts`; verifies signature, attaches `req.userId` |
| `attachUser` middleware | Load user + roles + effective permission set, attach to `req.user` | Runs after `authenticate`; one Prisma query with `include: { userRoles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } } }`; flatten to a `Set<permissionCode>` |
| `requirePermission(code)` middleware | Per-route guard; 403 if `req.user.permissions` lacks the code | Factory function used in route files: `router.post('/', requirePermission('SALES_ORDER_CREATE'), createSalesOrder)` |
| Audit capture | Record who/when/what/before/after for mutating actions | Prisma Client Extension intercepting create/update/delete (captures DB-level changes) **plus** explicit `AuditLogModel.record()` calls in controllers for actions that aren't simple CRUD (login, approve, reject, export) — extensions alone can't see "why"/"business action name" |
| `InventoryStockModel` (new) | Source of truth for lot/batch quantity; decrement on sale, restore on delete/edit, prevent overselling, recompute product-level rollup | New model file, used by `SalesOrderModel` and `ImportOrderModel` inside `prisma.$transaction()` |
| Approval state machine | Enforce valid status transitions (DRAFT→PENDING_APPROVAL→APPROVED/REJECTED, PENDING→CANCELLED), block self-approval, auto-trigger PENDING when thresholds exceeded | Small shared helper (`approvalStateMachine.ts`) imported by `SalesOrderModel`/`ImportOrderModel`; not a generic workflow engine — a lookup table of valid transitions + guard checks |
| `AuditLogModel` | Append-only writes to `audit_logs`; no update/delete exposed via API | Plain model with only `create()` and `findAll()` (for viewing) |
| Frontend `AuthProvider` + route guards | Store JWT, expose `user`/`permissions` via context, redirect unauthenticated users, hide/disable UI for unauthorized actions | New `apps/frontend/src/auth/` module; existing `useResource`/`client.ts` gain an `Authorization` header injector |

## Recommended Project Structure

```
apps/backend/src/
├── middleware/
│   ├── auth.ts                # authenticate() — verify JWT, attach req.userId
│   ├── permissions.ts         # attachUser(), requirePermission(code)
│   ├── audit.ts               # Prisma Client Extension for generic CRUD audit capture
│   └── errorHandler.ts        # existing — extend to map new HttpError codes (403, 409 for status transitions)
├── lib/
│   ├── prisma.ts              # existing singleton — apply $extends(auditExtension) here
│   └── jwt.ts                 # sign/verify helpers, token expiry config
├── models/
│   ├── user.model.ts          # new
│   ├── role.model.ts          # new
│   ├── permission.model.ts    # new
│   ├── auditLog.model.ts      # new — create()/findAll() only
│   ├── inventoryStock.model.ts# new — lot decrement/restore/rollup logic
│   ├── approval.model.ts      # new — shared transition/guard helper (not a DB table)
│   ├── salesOrder.model.ts    # existing — extended with license/stock/credit/approval checks
│   └── importOrder.model.ts   # existing — extended with approval + lot creation
├── controllers/
│   ├── auth.controller.ts     # new — login, logout, me
│   ├── user.controller.ts     # new
│   ├── role.controller.ts     # new
│   ├── auditLog.controller.ts # new — list only
│   └── salesOrder.controller.ts # existing — pass req.user.id into model calls, add approve/reject actions
├── routes/
│   ├── auth.routes.ts          # new — no auth required on /login
│   ├── user.routes.ts          # new — requirePermission('USER_MANAGE')
│   └── index.ts                 # existing — mount new routers, apply attachUser globally after auth
prisma/
└── schema.prisma               # add User/Role/Permission/UserRole/RolePermission/AuditLog models;
                                 # add approval + lot fields to existing Order/Stock models
```

### Structure Rationale

- **`middleware/auth.ts` + `middleware/permissions.ts` split:** mirrors the verified best practice of separating "who are you" (authentication) from "what can you do" (authorization) so routes can require just one or both. Keeps `requirePermission` reusable and declarative at the route level, matching the existing route-file convention.
- **`approval.model.ts` as a plain helper, not a table/engine:** the requirement is a single-level status machine (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED), not a configurable workflow engine. A lookup table of `{from, to, requiredPermission}` plus a `guardSelfApproval()` check is sufficient and keeps with the codebase's "plain object with methods" model pattern — avoid pulling in a workflow library (XState, temporal) for this scope.
- **`inventoryStock.model.ts` separate from `stockTransaction.model.ts`:** the existing `stockTransaction.model.ts` already handles reference-based reversal; the new model owns *lot quantity truth* and product-level rollup, and is called *by* `stockTransaction.model.ts`/`salesOrder.model.ts`, not the other way around. This preserves single-responsibility and avoids circular calls.
- **Audit via Prisma Client Extension + explicit calls, not `$use` middleware:** Prisma's legacy `$use` middleware API is deprecated; **Client Extensions (`$extends`)** are the current supported mechanism for intercepting queries (Prisma docs, 2026). Extensions can auto-capture create/update/delete on any model, but cannot express "this was an approval decision" or "this was a login" — those need explicit `AuditLogModel.record()` calls from controllers. Use **both**: extension for baseline CRUD trail, explicit calls for semantic actions (login, approve, reject, export). Confirmed caveat: Prisma discussion threads note client-extension query interception does not automatically join interactive transactions — audit inserts for transactional operations (e.g., sales order create+stock decrement) must be written explicitly inside the same `prisma.$transaction()` block, not relegated to the extension.

## Architectural Patterns

### Pattern 1: Middleware-chain authorization (authenticate → attachUser → requirePermission)

**What:** JWT verified once per request, user+role+permission set loaded once and attached to `req.user`, then a thin per-route guard checks a permission code against that set.
**When to use:** Every mutating and most read routes except `/login`, `/health`.
**Trade-offs:** Simple, matches existing middleware layer (`errorHandler.ts` precedent). Downside: permission set is loaded fresh per request (one extra Prisma query) — acceptable at this system's scale; add in-memory/short-TTL caching only if profiling shows it matters.

**Example:**
```typescript
// middleware/permissions.ts
export function requirePermission(code: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.permissions.has(code)) {
      return next(new HttpError(403, `Missing permission: ${code}`));
    }
    next();
  };
}

// routes/salesOrder.routes.ts
router.post('/', requirePermission('SALES_ORDER_CREATE'), createSalesOrder);
router.post('/:id/approve', requirePermission('SALES_ORDER_APPROVE'), approveSalesOrder);
```

### Pattern 2: Business rules and state transitions live in the Model layer, not Controllers

**What:** License validity, stock/lot availability, credit limit, discount threshold, and approval-transition checks are all evaluated inside `SalesOrderModel`/`ImportOrderModel` methods (typically inside a `prisma.$transaction()`), throwing `HttpError` on violation. Controllers stay thin (parse input, call model, format response) — this already matches the existing codebase convention.
**When to use:** Any rule that must be enforced regardless of which client calls the API (per PROJECT.md's "backend-first enforcement" constraint).
**Trade-offs:** Keeps controllers thin and testable; models grow larger and require care to keep transactions atomic (a failed stock decrement must roll back the order creation).

**Example:**
```typescript
// models/salesOrder.model.ts
async function create(input: SalesOrderInput, actingUserId: number) {
  return prisma.$transaction(async (tx) => {
    await assertValidLicense(tx, input.customerId);
    await InventoryStockModel.decrementLot(tx, input.lotId, input.quantity); // throws if insufficient
    await assertWithinCreditLimit(tx, input.customerId, input.total);
    const needsApproval = input.discount > customerDiscountLimit || input.total > creditThreshold;
    const order = await tx.salesOrder.create({
      data: { ...input, createdBy: actingUserId, status: needsApproval ? 'PENDING_APPROVAL' : 'APPROVED' },
    });
    await AuditLogModel.record(tx, { userId: actingUserId, action: 'CREATE', entity: 'SalesOrder', entityId: order.id, after: order });
    return order;
  });
}
```

### Pattern 3: Approval as a guarded status transition, not a separate workflow table

**What:** Approval status lives as a field on the order record itself (`status: DRAFT|PENDING_APPROVAL|APPROVED|REJECTED|CANCELLED`), with a small transition-guard function checked before any status change. A separate `approval_history` (or reuse `audit_logs`) table records who/when/decision/reason for traceability, but the *authoritative current state* is the field on the order.
**When to use:** Single-level approval (per PROJECT.md scope — multi-level explicitly deferred).
**Trade-offs:** Much simpler than a generic workflow engine; if multi-level approval is added later, the transition table and guard function can be extended without re-architecting (the DB schema note in the role doc explicitly designs for this).

**Example:**
```typescript
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['CANCELLED'],
  REJECTED: ['DRAFT'],
};

function assertTransition(from: string, to: string, actingUserId: number, createdBy: number) {
  if (!VALID_TRANSITIONS[from]?.includes(to)) throw new HttpError(409, `Invalid transition ${from}->${to}`);
  if (to === 'APPROVED' && actingUserId === createdBy) throw new HttpError(403, 'Cannot approve own transaction');
}
```

## Data Flow

### Request Flow (Sales Order Approval — representative of new cross-cutting flow)

```
[Manager clicks Approve in SalesOrdersPage]
    ↓
[POST /api/sales-orders/:id/approve, Authorization: Bearer <JWT>]
    ↓
authenticate() → verifies JWT → req.userId = 12
    ↓
attachUser() → loads user 12 + roles + permissions → req.user = {id:12, permissions:Set}
    ↓
requirePermission('SALES_ORDER_APPROVE') → passes (Manager role)
    ↓
approveSalesOrder controller → calls SalesOrderModel.approve(orderId, req.user.id)
    ↓
Model: fetch order → assertTransition(order.status, 'APPROVED', req.user.id, order.createdBy)
       → guard fails 403 if req.user.id === order.createdBy (self-approval block)
    ↓
Model: prisma.$transaction([
    update order.status = APPROVED, approvedBy, approvedAt,
    AuditLogModel.record({action:'APPROVE', entity:'SalesOrder', before, after})
  ])
    ↓
Controller: 200 OK with updated order
    ↓
Frontend: useResource updates local state, toast success
```

### Data Flow — Lot/Batch Stock Derivation

```
[Import receiving confirmed] → InventoryStockModel.receiveLot(product, warehouse, lotNo, qty, receivedDate)
    ↓ creates/updates InventoryStock row (lot-level truth)
    ↓ recomputes Product.stockQuantity = SUM(InventoryStock.quantityOnHand WHERE productId)
    ↓
[Sales order created with selected lotId + quantity]
    ↓ InventoryStockModel.decrementLot(lotId, qty) — throws HttpError(409) if qty > quantityOnHand
    ↓ recomputes Product.stockQuantity
    ↓
[Sales order deleted/edited]
    ↓ InventoryStockModel.restoreLot(previousLotId, previousQty) — reverses prior decrement
    ↓ InventoryStockModel.decrementLot(newLotId, newQty) — applies new decrement
    ↓ both wrapped in same prisma.$transaction as the order update
```

**Direction of truth:** `InventoryStock` (lot-level) → derived `Product.stockQuantity` (rollup), never the reverse. Any code path that still writes `Product.stockQuantity` directly must be removed/refactored as part of this milestone — this is the specific stock-sync inconsistency flagged in `.planning/codebase/CONCERNS.md`.

### Data Flow — Audit Log Capture

```
Any mutating model call (explicit AuditLogModel.record(), OR generic Prisma extension on create/update/delete)
    ↓
audit_logs row: { userId, action, entity, entityId, before (JSON), after (JSON), createdAt, ip? }
    ↓
Written inside the same prisma.$transaction as the business mutation (never a separate/best-effort write —
if the transaction rolls back, no audit row should persist for that attempt)
    ↓
AuditLogModel exposes only create() + findAll()/findByEntity() — no update/delete route exists,
enforced by simply never wiring PUT/DELETE routes for /api/audit-logs, and by DB-level design
(no application code path should ever call update/delete on this table)
```

### State Management

- Backend remains stateless (per existing architecture) — JWT carries identity, permission set is re-derived from DB per request (not embedded in the token as authoritative), avoiding the stale-permissions problem noted in verified best practices (a demoted user's old JWT would otherwise still grant old permissions). Token payload should carry only `userId` + short expiry; roles/permissions are always looked up fresh via `attachUser`.
- Frontend gains one new global concern: an `AuthContext` (token + current user + permission set) that existing `useResource`/`client.ts` reads to attach the `Authorization` header and to redirect to `/login` on 401. This is the first frontend global store the app has needed — acceptable as React Context, no need for Redux at this scale.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Current (single internal org, dozens of users) | Per-request permission lookup via Prisma is fine; JWT verify + one extra query per request is negligible overhead |
| Growth (multiple warehouses/branches, hundreds of users) | Add short-TTL in-memory cache (e.g., 30-60s) for the role→permission lookup keyed by userId to cut DB load; audit_logs table will need date-based indexing/partitioning as volume grows |
| Multi-level approval / larger org (future, explicitly out of scope now) | The DB schema (users/roles/user_roles/permissions/role_permissions, plus per-order status+approver fields) already supports adding an `approval_steps` table without breaking existing single-level flow — this is the extension point the role doc anticipates |

### Scaling Priorities

1. **First bottleneck:** `audit_logs` table growth (every create/update/delete/approve/reject/login/export writes a row) — mitigate with periodic archival/retention policy (per PROJECT.md's regulatory retention requirement) and an index on `(entity, entityId)` and `(createdAt)`.
2. **Second bottleneck:** Permission-lookup query on every request once user count grows — mitigate with short-lived in-memory cache before considering Redis; not needed at current scale.

## Anti-Patterns

### Anti-Pattern 1: Embedding roles/permissions in the JWT as the authorization source of truth

**What people do:** Put `role: "SALES_OFFICER"` or a full permission list in the JWT payload and check it directly on each request without re-querying the DB.
**Why it's wrong:** JWTs are immutable until expiry — revoking or changing a user's role/permission mid-session has no effect until the token expires, which directly conflicts with the audit/compliance intent of this milestone (an admin disabling a compromised or terminated user's access should take effect immediately, not after token TTL).
**Do this instead:** JWT carries only `userId` (identity claim) with a reasonably short expiry; `attachUser` middleware re-derives roles/permissions from the DB on every request. Confirmed as current best practice (Logto/RBAC guides, 2026).

### Anti-Pattern 2: Putting business-rule enforcement (license/stock/credit/approval checks) in Controllers

**What people do:** Check `if (customer.licenseExpired) return res.status(400)...` directly in the controller function.
**Why it's wrong:** Violates the existing layering (controllers are input/output shaping, models own business rules) and makes rules impossible to reuse across code paths (e.g., an internal script or a future bulk-import endpoint bypasses the check). It's also how the current codebase already got into "frontend-only enforcement" trouble per `.planning/PROJECT.md`.
**Do this instead:** Keep controllers thin; all rule enforcement happens inside model methods, inside the same `prisma.$transaction()` as the mutation, so a rule violation naturally rolls back partial writes.

### Anti-Pattern 3: Treating product-level stock and lot-level stock as two independently-updatable fields

**What people do:** Update `Product.stockQuantity` directly on sale/receive, and separately maintain `InventoryStock` rows, trusting both to stay in sync via app discipline.
**Why it's wrong:** This is the exact inconsistency already flagged in `.planning/codebase/CONCERNS.md` and is the root cause "prevent overselling" acceptance criteria call out. Any missed code path (a script, a manual DB fix, a future feature) desyncs the two.
**Do this instead:** `InventoryStock` is the only place quantity is ever decremented/incremented directly; `Product.stockQuantity` is always a computed/derived value (either recalculated on every lot mutation, or exposed as a query-time aggregate/view rather than a stored column, if read-performance allows).

### Anti-Pattern 4: Building a generic/configurable workflow engine for approval

**What people do:** Reach for a state-machine library (XState) or a generic multi-step workflow table to handle "approval" when only a single fixed DRAFT→PENDING→APPROVED/REJECTED flow is required.
**Why it's wrong:** Overkill for the stated scope (multi-level approval explicitly out of scope this milestone); adds a dependency and abstraction the team doesn't need yet, slows delivery.
**Do this instead:** A small `VALID_TRANSITIONS` lookup + guard function per entity (sales order, import order), following the existing "plain object with methods" model convention. Design the audit/status fields (per the role doc's `approved_by/approved_at/status_from/status_to`) so a future `approval_steps` table can be added without breaking this simpler version.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| None required | Custom auth (no Auth0/Supabase per PROJECT.md constraint) | JWT signing/verification via a small internal `lib/jwt.ts` using `jsonwebtoken` (Node-standard); password hashing via `bcrypt`/`argon2` |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Auth middleware ↔ Controllers | `req.user` object (id, roles, permissions Set) attached by middleware, read by controllers | Controllers must pass `req.user.id` explicitly into every model call that needs `createdBy`/`approvedBy`/audit attribution — do not have models reach into `req` directly (keeps models framework-agnostic and testable) |
| SalesOrderModel/ImportOrderModel ↔ InventoryStockModel | Direct function calls inside the same `prisma.$transaction()` (same process, no queue/event bus needed at this scale) | Lot decrement/restore must happen atomically with order create/update/delete — a queue-based/eventual-consistency approach would reintroduce the overselling risk this milestone exists to fix |
| Models ↔ AuditLogModel | Direct function call, same transaction | Never fire-and-forget; an audit write failure should fail the whole operation (compliance requirement implies audit completeness, not best-effort) |
| Frontend AuthContext ↔ existing `client.ts`/`useResource` | `client.ts` gains a header-injection hook reading the current token from AuthContext/localStorage; 401 responses trigger a redirect-to-login side effect | Minimal change to existing hook API — `useResource` signatures stay the same |

## Sources

- [Prisma Client Extensions documentation](https://www.prisma.io/docs/orm/prisma-client/client-extensions) — confirms `$extends` is the current supported query-interception mechanism (successor to deprecated `$use` middleware)
- [Prisma Client Extensions: 15 Practical Examples (Prisma blog)](https://www.prisma.io/blog/client-extensions-preview-8t3w27xkrxxn) — audit-log extension pattern
- [Prisma discussion #25043 — auditExtension interactive-transaction caveat](https://github.com/prisma/prisma/discussions/25043) — confirms extensions don't automatically join interactive transactions, informing the "explicit audit call inside $transaction" recommendation
- [Time Travel: Bulletproof Audit Logs with Prisma, Postgres, and NestJS](https://masoudx.medium.com/time-travel-bulletproof-audit-logs-with-prisma-postgres-and-nestjs-cb6d6c2f8b88) — before/after JSON capture pattern
- [Protect your Express.js API with RBAC and JWT validation (Logto docs)](https://docs.logto.io/api-protection/nodejs/express) — authenticate/authorize middleware separation pattern
- [Role-Based Access Control (RBAC) in Node.js, 2026](https://blog.dhirajroy.com/post/nodejs-rbac-roles-permissions) — permission-vs-role-in-JWT tradeoff, confirms re-deriving permissions per request over embedding in token
- Internal: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/STRUCTURE.md` — existing layered pattern this milestone extends
- Internal: `liquor-system-improvement-advice.md`, `liquor-system-basic-role-permission-recommendation.md` — authoritative requirements/schema for this milestone

---
*Architecture research for: Production-readiness additions (auth/RBAC/audit/lot-stock/approval) to Storage_Demo liquor system*
*Researched: 2026-09-03*
