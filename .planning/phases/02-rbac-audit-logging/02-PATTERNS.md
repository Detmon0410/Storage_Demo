# Phase 2: RBAC & Audit Logging - Pattern Map

**Mapped:** 2026-09-03
**Files analyzed:** 24 (12 backend new/modified, 12 covering schema/frontend/tests)
**Analogs found:** 22 / 24

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `apps/backend/prisma/schema.prisma` (+Role/Permission/UserRole/RolePermission/AuditLog, +createdById on ImportOrder/SalesOrder) | model (schema) | CRUD | existing `CustomerLicense`/`User` models in same file | exact (additive, same file/conventions) |
| `apps/backend/prisma/seed.ts` (extend: roles, permissions, role_permissions, assign SYSTEM_ADMIN to admin) | config/seed | batch | existing `seed.ts` (Phase 1 admin-user seed) | exact |
| `apps/backend/src/middleware/permission.ts` (new `requirePermission(code)`) | middleware | request-response | `apps/backend/src/middleware/auth.ts` (`requireAuth`) | exact |
| `apps/backend/src/lib/audit.ts` (new `AuditLogModel.record(tx, {...})`) | utility/service | event-driven (write-on-mutation) | `apps/backend/src/models/stockTransaction.model.ts` (`createStockTransactionTx` — tx-scoped helper fn) | role-match |
| `apps/backend/src/models/role.model.ts` (new — permission-union query) | model | CRUD (read-only union query) | `apps/backend/src/models/supplier.model.ts` (simple Prisma wrapper) + Pattern 1 in RESEARCH.md | role-match |
| `apps/backend/src/models/auditLog.model.ts` (new — `findMany` w/ filters, no update/delete) | model | CRUD (create+read only) | `apps/backend/src/models/supplier.model.ts` (subset: create/findAll only) | role-match |
| `apps/backend/src/models/user.model.ts` (extend: create/update/deactivate/reactivate/assignRoles, self-lockout guard) | model | CRUD | itself (existing `findByUsername`/`findById`/`create`) — extend using `supplier.model.ts` full-CRUD shape | exact |
| `apps/backend/src/models/importOrder.model.ts` (refactor: injectable `tx` client, add `createdById`) | model | CRUD + transactional | itself (existing internal `$transaction` pattern) | exact (self-refactor) |
| `apps/backend/src/models/salesOrder.model.ts` (same refactor + approve/reject fields) | model | CRUD + transactional | `apps/backend/src/models/importOrder.model.ts` (sibling, same shape) | exact |
| `apps/backend/src/models/stockTransaction.model.ts` (same injectable-client refactor) | model | CRUD + transactional | itself (already has `tx`-accepting helper functions `createStockTransactionTx`) — extend pattern to top-level `create`/`delete` | exact |
| `apps/backend/src/controllers/user.controller.ts` (new — CRUD + role assignment) | controller | request-response | `apps/backend/src/controllers/supplier.controller.ts` | role-match |
| `apps/backend/src/controllers/auditLog.controller.ts` (new — GET only, filters) | controller | request-response | `apps/backend/src/controllers/supplier.controller.ts` (`listSuppliers`, GET-only subset) | role-match |
| `apps/backend/src/controllers/importOrder.controller.ts` (wrap mutations in `$transaction` + audit call; add approve/reject handlers) | controller | request-response + transactional | itself (existing `createImportOrder`/`updateImportOrder`) | exact (self-refactor) |
| `apps/backend/src/controllers/salesOrder.controller.ts` (same + approve/reject) | controller | request-response + transactional | `apps/backend/src/controllers/importOrder.controller.ts` (sibling) | exact |
| `apps/backend/src/controllers/auth.controller.ts` (extend: login/logout emit AUDIT-02 events) | controller | request-response | itself (existing `login`/`logout`) | exact (self-extend) |
| `apps/backend/src/routes/user.routes.ts` (new) | route | request-response | `apps/backend/src/routes/supplier.routes.ts` | exact |
| `apps/backend/src/routes/auditLog.routes.ts` (new — GET only, no PUT/DELETE ever) | route | request-response | `apps/backend/src/routes/supplier.routes.ts` (subset: GET routes only) | role-match |
| `apps/backend/src/routes/importOrder.routes.ts` / `salesOrder.routes.ts` (add `requirePermission` per method + `/:id/approve`, `/:id/reject`) | route | request-response | `apps/backend/src/routes/supplier.routes.ts` (base) + RESEARCH.md Pattern 3 example | exact |
| All 11 existing `*.routes.ts` (add `requirePermission("MODULE_ACTION")` per route) | route | request-response | `apps/backend/src/routes/supplier.routes.ts` (template for the wiring change) | exact |
| `apps/backend/tests/rbac.*.test.ts`, `audit.*.test.ts`, `user.management.test.ts`, `order.noSelfApproval.test.ts` (new) | test | request-response (integration) | `apps/backend/tests/auth.enforcement.test.ts` + `apps/backend/tests/fixtures/testUser.ts` | exact |
| `apps/frontend/src/auth/AuthContext.tsx` (extend: carry `roles`/`permissions` from `/auth/me` or login response) | provider | request-response | itself (existing `login`/`applyToken` flow) | exact (self-extend) |
| `apps/frontend/src/components/layout/nav.ts` (add `requiresPermission` field to `NavItem`) | config | transform | itself (existing `NAV_GROUPS` structure) | exact (self-extend) |
| `apps/frontend/src/pages/UsersPage.tsx` (new) | component (page) | CRUD | `apps/frontend/src/pages/SuppliersPage.tsx` | exact |
| `apps/frontend/src/pages/AuditLogPage.tsx` (new) | component (page) | request-response (read/filter only) | `apps/frontend/src/pages/SuppliersPage.tsx` (subset: list+filter, no create/edit/delete modal) | role-match |

## Pattern Assignments

### `apps/backend/src/middleware/permission.ts` (middleware, request-response)

**Analog:** `apps/backend/src/middleware/auth.ts`

**Full existing file** (`auth.ts`, all 21 lines — this is the shape to mirror):
```typescript
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./errorHandler.js";
import { verifyAccessToken } from "../lib/jwt.js";

export interface AuthenticatedRequest extends Request {
  userId?: number;
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) return next(new HttpError(401, "Not authenticated"));
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired session"));
  }
}
```

**Key conventions to copy:** extend the request-augmenting interface pattern (`interface AuthenticatedRequest extends Request { userId?: number }` → `interface PermissionRequest extends AuthenticatedRequest { permissions?: Set<string> }`), throw via `HttpError` from `../middleware/errorHandler.js`, call `next(new HttpError(...))` on failure rather than writing the response directly, plain exported function (not a class), `.js` extensions on relative imports (ESM/NodeNext convention used project-wide).

**Composition order:** `requirePermission` runs strictly after `requireAuth` in the middleware chain — see Pattern Assignments below for route wiring. RESEARCH.md's Pattern 1 gives the concrete DB-query implementation (nested Prisma `include` from `User` → `UserRole` → `Role` → `RolePermission` → `Permission`); this PATTERNS.md file supplies the codebase-shape conventions RESEARCH.md's example should be adapted to.

---

### `apps/backend/src/lib/audit.ts` (utility, event-driven write-on-mutation)

**Analog:** `apps/backend/src/models/stockTransaction.model.ts` lines 1-3, 17-38 (tx-scoped helper function convention)

**Imports pattern** (lines 1-3):
```typescript
import { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
```

**Core pattern — a plain async function accepting `tx: Prisma.TransactionClient` as first arg, used both standalone and composed into a larger transaction** (lines 17-38):
```typescript
export async function createStockTransactionTx(tx: Prisma.TransactionClient, data: StockTransactionInput) {
  // ...validation against tx-scoped reads...
  const transaction = await tx.stockTransaction.create({ data });
  await tx.product.update({ where: { productId: data.productId }, data: { /* ... */ } });
  return transaction;
}
```
`AuditLogModel.record(tx, params)` in `lib/audit.ts` should follow this exact shape — a function taking `tx` first, doing one `tx.auditLog.create({...})`, called from inside controller-opened `prisma.$transaction(...)` blocks. Note this file lives under a new `lib/` module rather than `models/`, per RESEARCH.md's recommended project structure, but the code convention (tx-first param, project-native `Prisma.TransactionClient` type import from `@prisma/client`) is identical to this analog.

**Error handling:** reuse `HttpError` from `../middleware/errorHandler.js` for any not-found guards inside the audited transaction (see `importOrder.model.ts`'s `if (!existing) throw new HttpError(404, ...)` inside a `tx` callback, line 112 of that file).

---

### `apps/backend/src/models/user.model.ts` (model, CRUD — extend existing file)

**Analog:** `apps/backend/src/models/supplier.model.ts` (full file, 33 lines) for full-CRUD shape; existing `user.model.ts` for the file's own current conventions.

**Current `user.model.ts`** (entire file — extend, don't replace):
```typescript
import { prisma } from "../lib/prisma.js";

export const UserModel = {
  findByUsername: (username: string) => prisma.user.findUnique({ where: { username: username.toLowerCase() } }),
  findById: (id: number) => prisma.user.findUnique({ where: { id } }),
  create: (data: { username: string; passwordHash: string }) =>
    prisma.user.create({ data: { username: data.username.toLowerCase(), passwordHash: data.passwordHash } }),
};
```

**CRUD pattern to extend it with** (from `supplier.model.ts`, lines 18-32 — `update`/`delete` shape):
```typescript
update: (
  supplierId: number,
  data: Partial<{ supplierCode: string; supplierName: string; /* ... */ }>,
) => prisma.supplier.update({ where: { supplierId }, data }),

delete: (supplierId: number) => prisma.supplier.delete({ where: { supplierId } }),
```
Apply the same `Partial<{...}>` update-signature convention to `UserModel.update`. New methods needed beyond this analog: `deactivate`, `reactivate`, `assignRoles` (many-to-many `UserRole` writes), and the self-lockout guard (`assertNotLastAdmin`) — see RESEARCH.md Pattern 4 for the exact guard code (`apps/backend/src/models/user.model.ts` example, lines 383-395 of `02-RESEARCH.md`). No direct codebase analog exists for many-to-many role assignment; RESEARCH.md's example is the only source — flag as **no analog** for that specific sub-piece (see "No Analog Found" below).

---

### `apps/backend/src/models/importOrder.model.ts` / `salesOrder.model.ts` / `stockTransaction.model.ts` (model, CRUD + transactional — refactor for injectable `tx`)

**Analog:** self (existing file) — this is a refactor, not a new-pattern adoption.

**Current pattern to refactor away from** (`importOrder.model.ts` lines 64-87, `create`):
```typescript
create: (data: { /* ... */ }) => {
  const rows = toItemRows(data.items);
  return prisma.$transaction(async (tx) => {
    const order = await tx.importOrder.create({ data: { /* ... */ }, include: withRelations });
    await createStockInTx(tx, data.orderNo, data.items);
    return order;
  });
},
```

**Target shape** (from RESEARCH.md Architecture Pattern 2, cross-checked against this exact file's structure):
```typescript
import type { PrismaClient, Prisma } from "@prisma/client";
type Client = PrismaClient | Prisma.TransactionClient;

create: (data: { /* ...; */ createdById?: number }, client: Client = prisma) => {
  const rows = toItemRows(data.items);
  const run = async (tx: Client) => {
    const order = await tx.importOrder.create({ data: { /* ...existing fields..., */ createdById: data.createdById }, include: withRelations });
    await createStockInTx(tx as Prisma.TransactionClient, data.orderNo, data.items);
    return order;
  };
  return "$transaction" in client ? client.$transaction((tx) => run(tx)) : run(client);
},
```
Apply identically to `update`/`delete` in `importOrder.model.ts`, and to `create`/`update`/`delete` in `salesOrder.model.ts` (structurally identical sibling — same `withRelations`/tx-transaction shape). `stockTransaction.model.ts` already has the tx-first-param convention for its internal helpers (`createStockTransactionTx`, `reverseAndDeleteByReferenceTx`) — only its top-level `StockTransactionModel.create`/`delete` (lines 64, 66-74) need the same optional-client wrapping since those are the ones currently always opening `prisma.$transaction()` themselves.

**Scope note (per RESEARCH.md):** `category.model.ts`, `customer.model.ts`, `supplier.model.ts`, `license.model.ts` etc. do plain single `prisma.x.create()` calls with no internal transaction — no model refactor needed there; only the controller wraps the call in `prisma.$transaction` and calls `tx.x.create()` directly (or passes `tx` through if applying the optional-client convention project-wide for consistency, which RESEARCH.md recommends).

---

### `apps/backend/src/controllers/importOrder.controller.ts` / `salesOrder.controller.ts` (controller, request-response + transactional — extend existing + add approve/reject)

**Analog:** self (existing file) for existing handler shape; `apps/backend/src/controllers/supplier.controller.ts` for the plain-CRUD baseline convention.

**Current handler shape to keep for read/list, and to wrap for create/update/delete** (`importOrder.controller.ts`, full file pattern, lines 21-51):
```typescript
export const listImportOrders = asyncHandler(async (_req, res) => {
  res.json(await ImportOrderModel.findAll());
});

export const createImportOrder = asyncHandler(async (req, res) => {
  const { orderNo, supplierId, /* ... */ } = req.body;
  if (!orderNo || !supplierId /* ... */) {
    throw new HttpError(400, "orderNo, supplierId, ... are required");
  }
  res.status(201).json(await ImportOrderModel.create({ /* ... */ }));
});
```
Conventions: `asyncHandler` wrapper from `../utils/asyncHandler.js` (used on every controller export project-wide), manual required-field validation via `if (!field) throw new HttpError(400, ...)` (no zod on existing routes — zod is used only in `auth.controller.ts`; RESEARCH.md recommends zod for the *new* endpoints in this phase, which is consistent — new code can adopt zod while old handlers keep their manual-check style unless touched).

**New approve/reject handler pattern** — use RESEARCH.md's Code Examples section verbatim as the template (`02-RESEARCH.md` lines 574-598), which already matches this file's `asyncHandler`/`HttpError`/`req.userId` conventions:
```typescript
export const approveImportOrder = asyncHandler(async (req, res) => {
  const importOrderId = Number(req.params.id);
  const order = await prisma.$transaction(async (tx) => {
    const existing = await tx.importOrder.findUnique({ where: { importOrderId } });
    if (!existing) throw new HttpError(404, "Import order not found");
    if (existing.createdById != null && existing.createdById === req.userId) {
      throw new HttpError(403, "You cannot approve an order you created");
    }
    const updated = await tx.importOrder.update({ where: { importOrderId }, data: { status: "APPROVED", approver: req.username } });
    await AuditLogModel.record(tx, { entity: "ImportOrder", entityId: importOrderId, action: "approve", userId: req.userId ?? null, before: existing, after: updated });
    return updated;
  });
  res.json(order);
});
```
Apply the same shape to `salesOrder.controller.ts`'s `approveSalesOrder`/`rejectSalesOrder`, swapping `IMPORT_ORDER_APPROVE`→`SALES_ORDER_APPROVE` permission code and `tx.salesOrder`.

**Wrap existing create/update/delete** the same way — controller opens `prisma.$transaction`, calls the now-injectable model function with `tx`, then calls `AuditLogModel.record(tx, {...})` before returning, per RESEARCH.md Architecture Pattern 2's `createImportOrder` example (lines 334-350).

---

### `apps/backend/src/controllers/auth.controller.ts` (controller, request-response — extend existing)

**Analog:** self (existing `login`/`logout`, full file 62 lines already read)

**Current `login` structure to extend** (lines 30-46):
```typescript
export const login = asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Username and password required");
  const { username, password } = parsed.data;
  const user = await UserModel.findByUsername(username);
  const valid = await argon2.verify(user?.passwordHash ?? DUMMY_HASH, password).catch(() => false);
  if (!user || !valid || user.status !== "ACTIVE") throw new HttpError(401, "Invalid username or password");
  const accessToken = signAccessToken({ userId: user.id });
  const refreshToken = await RefreshTokenModel.create(user.id, REFRESH_TTL_MS);
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, REFRESH_COOKIE_OPTIONS);
  res.json({ accessToken, user: { id: user.id, username: user.username } });
});
```
Insert `await AuditLogModel.record(prisma, { entity: "User", entityId: user.id, action: "login", userId: user.id, before: null, after: { username: user.username } })` immediately before `res.json(...)`, per RESEARCH.md lines 645-658 — note `AuditLogModel.record` accepts `PrismaClient` directly here (no tx needed, single insert not paired with another mutation), which is why `lib/audit.ts`'s `record` signature must accept `PrismaClient | Prisma.TransactionClient`, not just `Prisma.TransactionClient`.

Same insertion point pattern applies to `logout` (lines 57-62) with `action: "logout"`.

**Also:** if RBAC-related, `AuthContext.tsx`'s consumption of `res.json({ accessToken, user: {...} })` on the frontend means adding `roles`/`permissions` to this response body (or a separate `/auth/me` call) is the natural extension point — see frontend AuthContext pattern below.

---

### `apps/backend/src/controllers/user.controller.ts` / `auditLog.controller.ts` (controller, new files, request-response)

**Analog:** `apps/backend/src/controllers/supplier.controller.ts` (full file, 42 lines)

**Full pattern to copy structurally**:
```typescript
import { SupplierModel } from "../models/supplier.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listSuppliers = asyncHandler(async (_req, res) => {
  res.json(await SupplierModel.findAll());
});

export const getSupplier = asyncHandler(async (req, res) => {
  const supplier = await SupplierModel.findById(Number(req.params.id));
  if (!supplier) throw new HttpError(404, "Supplier not found");
  res.json(supplier);
});
```
`user.controller.ts` mirrors this shape for `listUsers`/`getUser`/`createUser`/`updateUser`, plus new `deactivateUser`/`reactivateUser`/`assignRoles` actions following the same `asyncHandler` + `HttpError` + thin-pass-through-to-model convention. New-user creation must hash the password with `@node-rs/argon2` exactly as `auth.controller.ts` line 1 imports it (`import * as argon2 from "@node-rs/argon2"`).

`auditLog.controller.ts` mirrors only the `listSuppliers`-style GET handler (no create/update/delete controller functions exist for it at all, enforcing AUDIT-03 by omission) — combine with RESEARCH.md's `listAuditLogs` zod-filter example (`02-RESEARCH.md` lines 610-636) for the query-param validation, since none of the existing list handlers in this codebase take filter query params yet (no direct in-repo analog for filtered-list; zod schema on `req.query` is a new-but-consistent addition using the project's already-installed `zod` dependency).

---

### `apps/backend/src/routes/user.routes.ts` / `auditLog.routes.ts` (route, new files) + existing route-file modifications

**Analog:** `apps/backend/src/routes/supplier.routes.ts` (full file, 18 lines)

**Full pattern to copy**:
```typescript
import { Router } from "express";
import { createSupplier, deleteSupplier, getSupplier, listSuppliers, updateSupplier } from "../controllers/supplier.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const supplierRoutes = Router();

supplierRoutes.get("/", requireAuth, listSuppliers);
supplierRoutes.get("/:id", requireAuth, getSupplier);
supplierRoutes.post("/", requireAuth, createSupplier);
supplierRoutes.put("/:id", requireAuth, updateSupplier);
supplierRoutes.delete("/:id", requireAuth, deleteSupplier);
```

**Target shape for every mutating route across all 11 existing route files, plus new ones** (RESEARCH.md Pattern 3, `02-RESEARCH.md` lines 364-373 — matches this exact file's import/wiring style):
```typescript
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permission.js";

productRoutes.get("/", requireAuth, requirePermission("PRODUCT_VIEW"), listProducts);
productRoutes.post("/", requireAuth, requirePermission("PRODUCT_CREATE"), createProduct);
productRoutes.put("/:id", requireAuth, requirePermission("PRODUCT_EDIT"), updateProduct);
productRoutes.delete("/:id", requireAuth, requirePermission("PRODUCT_DELETE"), deleteProduct);
```

**`auditLog.routes.ts`** — GET-only subset of the same pattern, deliberately never registering POST/PUT/DELETE (AUDIT-03):
```typescript
export const auditLogRoutes = Router();
auditLogRoutes.get("/", requireAuth, requirePermission("AUDIT_LOG_VIEW"), listAuditLogs);
```

**`importOrder.routes.ts` / `salesOrder.routes.ts`** — add new approve/reject route registrations following the same `router.<method>(path, requireAuth, requirePermission(code), handler)` chain shape:
```typescript
importOrderRoutes.post("/:id/approve", requireAuth, requirePermission("IMPORT_ORDER_APPROVE"), approveImportOrder);
importOrderRoutes.post("/:id/reject", requireAuth, requirePermission("IMPORT_ORDER_REJECT"), rejectImportOrder);
```

---

### `apps/backend/tests/*.test.ts` (test, request-response/integration)

**Analog:** `apps/backend/tests/auth.enforcement.test.ts` (full-file pattern) + `apps/backend/tests/fixtures/testUser.ts`

**Fixture convention** (`fixtures/testUser.ts`, full file, 9 lines):
```typescript
import * as argon2 from "@node-rs/argon2";
import { prisma } from "../setup.js";

export async function createTestUser(suffix: string, password = "TestPass123") {
  const username = `test_${suffix}_${Date.now()}`;
  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.create({ data: { username, passwordHash, status: "ACTIVE" } });
  return { user, username, password };
}
```
Extend with `createTestUserWithRole(roleCode, suffix)` per RESEARCH.md's Pitfall 6 recommendation — same shape, plus an additional `prisma.userRole.create({ data: { userId: user.id, roleId: <lookup by roleCode> } })` step.

**Test-body convention** (`auth.enforcement.test.ts`, lines 1-29, 47-62 — login-then-request-then-assert):
```typescript
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { cleanupTestUsers, prisma } from "./setup.js";
import { createTestUser } from "./fixtures/testUser.js";

describe("GET route authentication enforcement", () => {
  afterAll(cleanupTestUsers);

  it("returns 401 for GET /api/categories with no Authorization header", async () => {
    const res = await request(app).get("/api/categories");
    expect(res.status).toBe(401);
  });

  it("returns 200 with an array for GET /api/categories with a valid access token", async () => {
    const { username, password } = await createTestUser("enforcement_get");
    const loginRes = await request(app).post("/api/auth/login").send({ username, password });
    const accessToken = loginRes.body.accessToken;
    const res = await request(app).get("/api/categories").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });
});
```
For the RBAC-04 permission-denial matrix, use `it.each`/`describe.each` per RESEARCH.md Pitfall 6, keeping this same `request(app).<method>(path).set("Authorization", ...)` supertest convention as the test body, with role/route/expected-status as the parameterized table data. `fileParallelism: false` in `apps/backend/vitest.config.ts` and `cleanupTestUsers` from `./setup.js` must be reused unchanged (do not create a new cleanup mechanism).

---

### `apps/frontend/src/auth/AuthContext.tsx` (provider, request-response — extend existing)

**Analog:** self (existing file, full 103 lines already read)

**Current shape to extend** (lines 6-17, 64-80):
```typescript
interface AuthUser {
  id: number;
  username: string;
}
interface AuthContextValue {
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
// ...
const login = useCallback(async (username: string, password: string) => {
  const res = await fetch(`${BASE_URL}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ username, password }) });
  if (!res.ok) { /* ... */ }
  const data = await res.json();
  applyToken(data.accessToken, data.user);
}, [applyToken]);
```
Extend `AuthUser` with `roles: string[]` and `permissions: string[]` (or fetch a separate `/auth/me` after login per RESEARCH.md's architecture diagram — `GET /api/auth/me` — fetched once after login/refresh). Note the existing silent-refresh comment at lines 47-51 already documents that `/refresh` doesn't return user identity — the same gap applies to permissions; the new `/auth/me` call (or equivalent) needs to run after both `login` and the silent-refresh `useEffect` (lines 41-62), not just after `login`.

---

### `apps/frontend/src/components/layout/nav.ts` (config — extend existing)

**Analog:** self (existing file, full 59 lines)

**Current shape** (lines 15-24):
```typescript
export interface NavItem {
  to: string;
  labelKey: string;
  icon: LucideIcon;
}
export interface NavGroup {
  titleKey: string;
  items: NavItem[];
}
```
Add `requiresPermission?: string` to `NavItem` per RESEARCH.md's structure section, then filter `NAV_GROUPS` at render time in whatever component consumes it (likely `Sidebar.tsx` under `components/layout/`) against `useAuth().permissions`. New nav entries: `{ to: "/users", labelKey: "nav.item.users", icon: Users, requiresPermission: "USER_MANAGEMENT_FULL" }` and `{ to: "/audit-logs", labelKey: "nav.item.auditLogs", icon: FileCheck2 (or similar), requiresPermission: "AUDIT_LOG_VIEW" }` — reuse an already-imported icon from `lucide-react` (the file already imports `Users` for the Customers nav item; a distinct icon should be chosen to avoid visual collision, confirm against `02-UI-SPEC.md`).

---

### `apps/frontend/src/pages/UsersPage.tsx` / `AuditLogPage.tsx` (component/page, CRUD / request-response)

**Analog:** `apps/frontend/src/pages/SuppliersPage.tsx` (full file, 216 lines)

**Structural pattern to copy** (imports, lines 1-17):
```typescript
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { supplierApi } from "../api/resources";
import type { Supplier } from "../api/types";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { type Column, DataTable } from "../components/ui/DataTable";
import { Field, FormGrid, SelectField, TextInput } from "../components/ui/Field";
import { Modal } from "../components/ui/Modal";
import { PageHeader } from "../components/ui/PageHeader";
import { SearchInput } from "../components/ui/SearchInput";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { useToast } from "../components/ui/Toast";
import { useResource } from "../hooks/useResource";
import { statusTone } from "../lib/status";
```

**Core CRUD+modal pattern** (lines 39-103, condensed): `useResource(<resourceApi>, (r) => <idField>)` hook for `rows/loading/error/saving/reload/create/update/remove`; local `form`/`editing`/`deleting` state; `handleSubmit`/`handleDelete` wrapping the hook calls in try/catch with `useToast()` success/error messages using i18next keys (`t("supplier.toast.updated", {...})`); `Modal`/`ConfirmDialog`/`DataTable` composition (lines 137-214).

**For `UsersPage.tsx`:** same shape, using a new `userApi` resource (to be added to `apps/frontend/src/api/resources.ts`) and `User` type; per CONTEXT.md D-03, the multi-role-assignment interaction (checkboxes/multi-select for 6 roles) is new UI not present in any existing page — follow `02-UI-SPEC.md` for that specific sub-component, using the existing `Field`/`FormGrid` primitives from `components/ui/Field.tsx` as the layout wrapper (no direct in-repo analog for a multi-checkbox field — check `Field.tsx` for a `CheckboxField` export before assuming one needs to be built from scratch).

**For `AuditLogPage.tsx`:** narrower subset — `DataTable` + `SearchInput`-style filter controls (entity/user/action/date-range), but **no** `Modal`/`ConfirmDialog`/create-edit-delete affordances (append-only, view-only per AUDIT-03/D-04). Use `SuppliersPage.tsx`'s list-rendering half only (lines 105-158: `columns` array + `DataTable`/`LoadingState`/`ErrorState`/`EmptyState` block), dropping the modal/delete-confirmation half entirely. Filter UI should follow `02-UI-SPEC.md`'s filter/table layout spec.

---

## Shared Patterns

### `asyncHandler` wrapper
**Source:** `apps/backend/src/utils/asyncHandler.ts` (used in every controller: `supplier.controller.ts`, `importOrder.controller.ts`, `auth.controller.ts`)
**Apply to:** every new controller export (`user.controller.ts`, `auditLog.controller.ts`, new approve/reject handlers)
```typescript
export const listSuppliers = asyncHandler(async (_req, res) => {
  res.json(await SupplierModel.findAll());
});
```

### `HttpError` + centralized `errorHandler`
**Source:** `apps/backend/src/middleware/errorHandler.ts` (full file, 32 lines)
**Apply to:** every new controller/model/middleware that needs to signal 400/401/403/404/409
```typescript
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
// centrally handled: HttpError -> res.status(err.status).json({ error: err.message })
// Prisma P2025 -> 404, P2002 -> 409, P2003 -> 409 (already handles FK/unique conflicts generically —
// no special-casing needed for new AuditLog/Role/Permission/UserRole/RolePermission models)
```

### `requireAuth` middleware composition
**Source:** `apps/backend/src/middleware/auth.ts`
**Apply to:** every route file — `requirePermission` is always chained immediately after `requireAuth`, never standalone (permission check assumes `req.userId` is already set)

### Route registration order
**Source:** `apps/backend/src/routes/supplier.routes.ts` and all 10 sibling route files (identical shape: `Router()` export, `get("/")`, `get("/:id")`, `post("/")`, `put("/:id")`, `delete("/:id")`)
**Apply to:** all route-file modifications wiring in `requirePermission` — insert the middleware into the existing chain, do not restructure route ordering/paths

### Prisma `@map`/`@@map` snake_case naming
**Source:** `apps/backend/prisma/schema.prisma` (every existing model — e.g. `Supplier { supplierId Int @id @default(autoincrement()) @map("supplier_id") ... @@map("suppliers") }`)
**Apply to:** all new models (`Role`, `Permission`, `UserRole`, `RolePermission`, `AuditLog`) — camelCase Prisma fields, `@map("snake_case")` DB columns, `@@map("snake_case_plural")` table names, exactly as RESEARCH.md's Code Examples section already drafts (consistent with this convention)

### `useResource` hook + toast/i18n pattern
**Source:** `apps/frontend/src/hooks/useResource.ts` (consumed identically by `SuppliersPage.tsx`, `ProductsPage.tsx`, `CustomersPage.tsx`, etc.)
**Apply to:** `UsersPage.tsx` (full CRUD via `useResource`); `AuditLogPage.tsx` likely needs a read-only variant or direct `client.ts` call with query-param filters instead, since `useResource` in existing pages does not appear to support server-side filter params (needs Read confirmation of `useResource.ts` internals at plan time — flagged as an open question below)

## No Analog Found

Files/sub-patterns with no close match in the codebase (planner should use RESEARCH.md's own code examples instead, since RESEARCH.md already resolved these with codebase-informed reasoning):

| File / Sub-pattern | Role | Data Flow | Reason |
|---|---|---|---|
| `requirePermission` DB-query implementation (nested `include` User→UserRole→Role→RolePermission→Permission) | middleware (query logic) | request-response | No existing middleware in the codebase queries beyond one level of relation; `RESEARCH.md` Pattern 1 (`02-RESEARCH.md` lines 229-273) is the only source — flagged there as `[ASSUMED]`, confirm against a real query in Wave 1 |
| Self-lockout guard (`assertNotLastAdmin`) | model (business rule) | CRUD | No existing model has an aggregate-count guard before a mutation; `RESEARCH.md` Pattern 4 (lines 383-395) is the only source |
| Many-to-many role-assignment write (`UserModel.assignRoles`) | model | CRUD | No existing model in this codebase writes to a join table directly (`ImportOrderItem`/`SalesOrderItem` are 1-to-many child rows via nested `create`, not a pure many-to-many join like `UserRole`) — closest partial precedent is `importOrder.model.ts`'s `items: { create: rows }` nested-write pattern, but that's not a true M:N update/replace-all operation; RESEARCH.md does not fully spec this either — planner should design `assignRoles` as delete-all-then-recreate-`UserRole`-rows-in-a-tx, consistent with this project's transaction conventions |
| Multi-checkbox "assign N of 6 roles" form field UI | component | transform | No existing form field in `components/ui/Field.tsx` handles multi-select checkboxes (existing forms use single-value `SelectField`/`TextInput` only) — check `Field.tsx` for a `CheckboxField` export before building new; if absent, `02-UI-SPEC.md` is the authoritative source for this specific interaction, not any existing page |
| Server-side filtered list query (`GET /api/audit-logs?entity=&user=&action=&from=&to=`) | controller + frontend fetch | request-response | No existing endpoint in the codebase accepts filter query params (all existing `findAll()` calls take zero args) — RESEARCH.md's `listAuditLogs` example (lines 610-636) is the only source; frontend-side, confirm whether `useResource`/`client.ts` supports passing query params or whether `AuditLogPage.tsx` needs a bespoke fetch call |

## Metadata

**Analog search scope:** `apps/backend/src/{middleware,models,controllers,routes}`, `apps/backend/prisma/{schema.prisma,seed.ts}`, `apps/backend/tests/`, `apps/frontend/src/{auth,components,pages,hooks}`
**Files scanned:** ~30 (11 controllers, 13 models, 12 routes, 3 middleware, schema.prisma, seed.ts, 8 test files + fixtures, AuthContext.tsx, RequireAuth.tsx, nav.ts, SuppliersPage.tsx, ui/ component directory listing)
**Pattern extraction date:** 2026-09-03
