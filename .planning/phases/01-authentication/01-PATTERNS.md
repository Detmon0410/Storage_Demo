# Phase 1: Authentication - Pattern Map

**Mapped:** 2026-09-03
**Files analyzed:** 20
**Analogs found:** 17 / 20

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/backend/prisma/schema.prisma` (add `User`, `RefreshToken` models) | model (schema) | CRUD | existing models in same file (`Category`, `CustomerLicense`) | exact (same file, additive) |
| `apps/backend/src/models/user.model.ts` | model | CRUD | `apps/backend/src/models/category.model.ts` | role-match |
| `apps/backend/src/models/refreshToken.model.ts` | model | CRUD + revocation | `apps/backend/src/models/customerLicense.model.ts` (status/lifecycle field updates) | partial |
| `apps/backend/src/lib/jwt.ts` | utility | transform (sign/verify) | `apps/backend/src/lib/prisma.ts` (lib singleton convention) + `utils/stockReference.ts` (pure helper convention) | partial |
| `apps/backend/src/lib/refreshTokenCrypto.ts` (or inline in `refreshToken.model.ts`) | utility | transform (hash/random) | `apps/backend/src/utils/stockReference.ts` | partial |
| `apps/backend/src/controllers/auth.controller.ts` | controller | request-response | `apps/backend/src/controllers/category.controller.ts` | role-match |
| `apps/backend/src/routes/auth.routes.ts` | route | request-response | `apps/backend/src/routes/category.routes.ts` | exact |
| `apps/backend/src/routes/index.ts` (modify — mount auth routes + `requireAuth`) | route | request-response | same file, existing structure | exact (same file, additive) |
| `apps/backend/src/middleware/auth.ts` (`requireAuth`) | middleware | request-response | `apps/backend/src/middleware/errorHandler.ts` (only existing middleware) | role-match |
| `apps/backend/src/middleware/rateLimiter.ts` | middleware | request-response | `apps/backend/src/middleware/errorHandler.ts` (only existing middleware, for file/module shape) | partial (no rate-limit analog exists) |
| `apps/backend/src/index.ts` (modify — cors/cookieParser/rateLimit wiring) | config | request-response | same file (existing `cors()`/`express.json()` wiring) | exact (same file, additive) |
| `apps/backend/prisma/seed.ts` (extend — create default admin) | migration/seed | batch | same file, existing `main()` transaction pattern | exact (same file, additive) |
| `apps/backend/package.json` (add deps) | config | — | existing `dependencies`/`devDependencies` blocks | exact (same file, additive) |
| `apps/frontend/src/auth/AuthContext.tsx` | provider | request-response (bootstrap on mount) | `apps/frontend/src/hooks/useResource.ts` (load-on-mount + async state pattern) | role-match |
| `apps/frontend/src/auth/RequireAuth.tsx` | component (route guard) | request-response | `apps/frontend/src/components/layout/AppShell.tsx` (`Outlet`-wrapping layout component) | role-match |
| `apps/frontend/src/pages/LoginPage.tsx` | component (page) | request-response | `apps/frontend/src/pages/CategoriesPage.tsx` (form + API-call page pattern) | role-match |
| `apps/frontend/src/api/client.ts` (modify — attach Authorization header, `credentials: include`, 401 handling) | service (API client) | request-response | same file, existing `request()` function | exact (same file, additive) |
| `apps/frontend/src/App.tsx` (modify — add `/login` route + wrap routes in `RequireAuth`) | route (frontend router) | request-response | same file, existing `<Routes>` tree | exact (same file, additive) |
| `apps/backend/tests/auth.*.test.ts` (6 files) | test | request-response | none — zero test files exist anywhere in repo | no analog |
| `apps/backend/vitest.config.ts`, `apps/backend/tests/setup.ts` | config/test | — | none — zero test tooling exists | no analog |

## Pattern Assignments

### `apps/backend/prisma/schema.prisma` (model, additive)

**Analog:** existing `Category`/`CustomerLicense` models in the same file (lines 10-19, 142-169)

**Naming convention** — camelCase Prisma fields mapped to snake_case columns via `@map`, table name via `@@map`, string-status fields default to a literal, id fields use `@id @default(autoincrement()) @map("..._id")`:
```prisma
model Category {
  categoryId   Int       @id @default(autoincrement()) @map("category_id")
  categoryCode String    @unique @map("category_code")
  ...
  @@map("categories")
}
```
`CustomerLicense` (lines 142-169) shows the lifecycle-field convention to follow for `RefreshToken`/`User` (`createdAt`/`updatedAt` with `@default(now())`/`@updatedAt`, nullable `*At`/`*By` audit columns, an enum for status):
```prisma
model CustomerLicense {
  ...
  status            CustomerLicenseStatus @default(PENDING)
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")
  statusChangedBy   String?   @map("status_changed_by")
  statusChangedAt   DateTime? @map("status_changed_at")
}
```
**Apply to new models:**
```prisma
enum UserStatus {
  ACTIVE
  INACTIVE
}

model User {
  id           Int      @id @default(autoincrement()) @map("user_id")
  username     String   @unique
  passwordHash String   @map("password_hash")
  status       UserStatus @default(ACTIVE)
  createdAt    DateTime @default(now()) @map("created_at")
  refreshTokens RefreshToken[]

  @@map("users")
}

model RefreshToken {
  id        Int      @id @default(autoincrement()) @map("refresh_token_id")
  tokenHash String   @unique @map("token_hash")
  userId    Int      @map("user_id")
  expiresAt DateTime @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User @relation(fields: [userId], references: [id])

  @@map("refresh_tokens")
}
```
Run `prisma db push` (per `db:setup` script) after adding — this project has no migration files, schema changes apply directly.

---

### `apps/backend/src/models/user.model.ts` (model, CRUD)

**Analog:** `apps/backend/src/models/category.model.ts` (full file, 17 lines — read in full above)

**Core CRUD pattern to copy:**
```typescript
import { prisma } from "../lib/prisma.js";

export const CategoryModel = {
  findAll: () => prisma.category.findMany({ orderBy: { categoryId: "asc" } }),
  findById: (categoryId: number) => prisma.category.findUnique({ where: { categoryId } }),
  create: (data: { categoryCode: string; categoryName: string; description?: string; isActive?: boolean }) =>
    prisma.category.create({ data }),
  update: (categoryId: number, data: Partial<{...}>) => prisma.category.update({ where: { categoryId }, data }),
  delete: (categoryId: number) => prisma.category.delete({ where: { categoryId } }),
};
```
**Apply to `UserModel`:** single object literal export, `prisma` import from `../lib/prisma.js`, plain functions (no classes). Add `findByUsername(username: string)` (normalize to lowercase per Pitfall 5) and `verifyPassword`-adjacent helper is better placed in the controller (using `argon2.verify` directly) to keep the model a thin Prisma wrapper, consistent with every existing model in this codebase never importing business-logic libraries.

---

### `apps/backend/src/models/refreshToken.model.ts` (model, CRUD + revocation)

**Analog:** `apps/backend/src/models/salesOrder.model.ts` for the `prisma.$transaction` usage convention (lines 1-12, 59-101) — shows how this codebase wraps multi-step writes in a transaction and imports `HttpError` directly into models for domain validation:
```typescript
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
```
**Apply to `RefreshTokenModel`:** Use the RESEARCH.md Pattern 2 code directly (already vetted against this codebase's conventions) — `generateOpaqueToken()`, `hash()`, `create/findValid/revoke`, all as plain exported functions in one object literal like `CategoryModel`, using `prisma` from `../lib/prisma.js`. No transaction needed since it's single-row writes, unlike `salesOrder.model.ts`'s multi-table case.

---

### `apps/backend/src/lib/jwt.ts` (utility, transform)

**Analog:** `apps/backend/src/lib/prisma.ts` (singleton pattern) for the `lib/` directory convention (currently just one file: a `PrismaClient` singleton export), and `apps/backend/src/utils/stockReference.ts` for the "small pure-function utility module" shape used elsewhere in the codebase.

**Convention:** `lib/` currently holds only `prisma.ts` (3 lines: import, instantiate, export). New `lib/jwt.ts` should follow the same "tiny, single-purpose, no class" style — read `JWT_SECRET`/`JWT_EXPIRES_IN` from `process.env` (matches `apps/backend/src/index.ts`'s existing `process.env.PORT ?? 4000` fallback style), export `signAccessToken(payload)` / `verifyAccessToken(token)` functions using `jsonwebtoken`, pinning `algorithms: ["HS256"]` per RESEARCH.md.

---

### `apps/backend/src/controllers/auth.controller.ts` (controller, request-response)

**Analog:** `apps/backend/src/controllers/category.controller.ts` (full file, 34 lines — read in full above)

**Imports pattern** (lines 1-3):
```typescript
import { CategoryModel } from "../models/category.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
```
**Core request-response pattern** (lines 5-21) — every handler is `asyncHandler(async (req, res) => {...})`, validates required body fields with a manual `if (!x) throw new HttpError(400, "...")`, and calls the model directly (no service layer):
```typescript
export const createCategory = asyncHandler(async (req, res) => {
  const { categoryCode, categoryName, description, isActive } = req.body;
  if (!categoryCode || !categoryName) {
    throw new HttpError(400, "categoryCode and categoryName are required");
  }
  res.status(201).json(await CategoryModel.create({ categoryCode, categoryName, description, isActive }));
});
```
**Apply to `auth.controller.ts`:** `login`, `refresh`, `logout` handlers follow this exact `asyncHandler` + `HttpError` shape. Use RESEARCH.md's Code Examples section (`login`/`refresh` snippets) verbatim as the body — they already match this project's `asyncHandler`/`HttpError`/model-call conventions precisely (confirmed by direct comparison against `category.controller.ts`).

**Error handling pattern:** No try/catch inside handlers anywhere in this codebase — `asyncHandler` forwards rejections to the global `errorHandler` (see Shared Patterns below). Auth handlers should follow this exactly: `throw new HttpError(401, "...")` for auth failures, never manual `res.status(401)`.

---

### `apps/backend/src/routes/auth.routes.ts` (route, request-response)

**Analog:** `apps/backend/src/routes/category.routes.ts` (full file, 17 lines — read in full above)

**Pattern to copy:**
```typescript
import { Router } from "express";
import { createCategory, deleteCategory, getCategory, listCategories, updateCategory } from "../controllers/category.controller.js";

export const categoryRoutes = Router();

categoryRoutes.get("/", listCategories);
categoryRoutes.post("/", createCategory);
```
**Apply to `auth.routes.ts`:**
```typescript
import { Router } from "express";
import { login, refresh, logout } from "../controllers/auth.controller.js";
import { loginRateLimiter } from "../middleware/rateLimiter.js";

export const authRoutes = Router();

authRoutes.post("/login", loginRateLimiter, login);
authRoutes.post("/refresh", refresh);
authRoutes.post("/logout", logout);
```

---

### `apps/backend/src/routes/index.ts` (modify — mount `authRoutes`, apply `requireAuth`)

**Analog:** same file, existing structure (full file, 27 lines — read in full above). Import + `apiRoutes.use(path, router)` pattern is already established for all 10 routers.

**Wave 1 (no enforcement yet):**
```typescript
import { authRoutes } from "./auth.routes.js";
// ...
apiRoutes.use("/auth", authRoutes);
apiRoutes.use("/categories", categoryRoutes);
// ...unchanged
```
**Wave 3 (single-line enforcement toggle, per D-08/Pitfall 1 — must be its own later change, not bundled with Wave 1):**
```typescript
import { requireAuth } from "../middleware/auth.js";
apiRoutes.use("/auth", authRoutes); // stays outside requireAuth
apiRoutes.use(requireAuth); // everything below now requires a valid session
apiRoutes.use("/categories", categoryRoutes);
// ...remaining 9 routers unchanged
```

---

### `apps/backend/src/middleware/auth.ts` (`requireAuth`) (middleware, request-response)

**Analog:** `apps/backend/src/middleware/errorHandler.ts` (full file, 33 lines — read in full above) — the only existing middleware in the codebase; establishes the `HttpError` class and the Express middleware function-export convention (no default export, named `export function`).

**Pattern to copy (class-based error convention)** (lines 4-11):
```typescript
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
```
**Apply to `requireAuth`:** Use RESEARCH.md's `requireAuth` code example verbatim — it already imports `HttpError` from `./errorHandler.js` and follows the `(req, res, next)` signature style consistent with `errorHandler`'s `(err, req, res, next)` signature (both use `type { NextFunction, Request, Response } from "express"` import style).

---

### `apps/backend/src/middleware/rateLimiter.ts` (middleware, request-response)

**No strong analog** — no rate-limiting or request-throttling code exists anywhere in this codebase (confirmed via `CONCERNS.md`). Use RESEARCH.md's CORS + rate limiter wiring Code Example directly. Follow `errorHandler.ts`'s file-shape convention (single named export, no default export) for consistency:
```typescript
import rateLimit from "express-rate-limit";

export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later" },
});
```

---

### `apps/backend/src/index.ts` (modify — cors/cookieParser/rateLimit wiring)

**Analog:** same file, existing wiring (full file, 27 lines — read in full above)

**Current pattern** (lines 12-13):
```typescript
app.use(cors());
app.use(express.json());
```
**Apply (Wave 1):**
```typescript
import cookieParser from "cookie-parser";

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "").split(",").filter(Boolean);

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(cookieParser());
```
Follows the file's existing `process.env.X ?? default` fallback convention already used for `PORT`/`HOST` (lines 9-10).

---

### `apps/backend/prisma/seed.ts` (extend — default System Admin)

**Analog:** same file, existing `main()` transaction structure (imports lines 1-7, entity-creation loop pattern e.g. lines 515-521 `prisma.category.create`, top-level structure lines 493-767)

**Pattern to copy:**
```typescript
import { CustomerLicenseStatus, PrismaClient, TransactionType } from "@prisma/client";
import { CustomerLicenseModel } from "../src/models/customerLicense.model.js";
// ...
const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction([...]);
  for (const category of categories) {
    const record = await prisma.category.create({ data: category });
  }
  // ...
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
  });
```
**Apply:** Add a default admin creation block inside `main()` (or immediately before/after the existing entity loops), hashing a fixed dev password with `argon2.hash()` before `prisma.user.create()`. Keep it idempotent-safe if `db:setup`/`db:seed` can rerun (check `findUnique` first or rely on `@unique` constraint + catch, matching how other seed sections handle uniqueness implicitly via fresh `db push`).

---

### `apps/frontend/src/auth/AuthContext.tsx` (provider, request-response bootstrap)

**Analog:** `apps/frontend/src/hooks/useResource.ts` (full file, 81 lines — read in full above) — closest existing "load async state on mount, expose loading/error, expose mutator functions" pattern in the frontend.

**Load-on-mount + loading/error state pattern** (lines 16-36):
```typescript
const [rows, setRows] = useState<T[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

const load = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const data = await api.list();
    setRows(data);
  } catch (err) {
    setError(err instanceof ApiError ? err.message : i18n.t("common.httpError", { status: "?" }));
  } finally {
    setLoading(false);
  }
}, [api]);

useEffect(() => {
  load();
}, [load]);
```
**Apply to `AuthProvider`:** same `loading`/`error`-style local state, but for `accessToken`/`user`, calling `fetch(.../auth/refresh, { credentials: "include" })` on mount per RESEARCH.md Pattern 1 instead of `api.list()`. Use `ApiError`/`i18n` from `../api/client` and `../i18n` exactly as `useResource.ts` does (line 2-3 imports) for consistent error-message handling.

---

### `apps/frontend/src/auth/RequireAuth.tsx` (component, route guard)

**Analog:** `apps/frontend/src/components/layout/AppShell.tsx` (full file, 36 lines — read in full above) — the only existing component that wraps `<Outlet/>` and is used as a `<Route element={...}>` wrapper in `App.tsx`.

**Pattern to copy** (lines 8, 24-34):
```typescript
export function AppShell() {
  ...
  return (
    <div ...>
      ...
      <main ...>
        <Outlet />
      </main>
    </div>
  );
}
```
**Apply to `RequireAuth`:** Same "functional component rendering `<Outlet/>`, used as `<Route element={<RequireAuth/>}>` wrapper" shape, but conditionally renders `<Navigate to="/login"/>` vs `<Outlet/>` based on `AuthContext`'s `user`/`loading` state, consistent with `react-router-dom` already being the routing library (see `App.tsx` imports).

---

### `apps/frontend/src/pages/LoginPage.tsx` (component, page)

**Analog:** `apps/frontend/src/pages/CategoriesPage.tsx` — nearest existing "form + API call" page pattern using `Field`, `Button` UI components and `useTranslation`.

**Apply:** Use existing `components/ui/Field.tsx` and `components/ui/Button.tsx` for form inputs/submit consistent with every other page in this codebase (not a bespoke login UI). Call `AuthContext`'s `login()` function (which POSTs to `/api/auth/login`) rather than `createResourceApi`, since login isn't a CRUD resource.

---

### `apps/frontend/src/api/client.ts` (modify — Authorization header + credentials + 401 handling)

**Analog:** same file, existing `request()` function (full file, 49 lines — read in full above)

**Current pattern** (lines 13-19):
```typescript
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(0, i18n.t("common.connectionError"));
  }
```
**Apply:** Add `credentials: "include"` to every `fetch` call (needed for the refresh-token cookie per Pitfall 2), and inject `Authorization: Bearer <token>` from `AuthContext`'s in-memory token — since `client.ts` is a plain module (no React context access), the cleanest approach consistent with this file's existing shape is to expose a `setAccessToken(token)` setter that `AuthContext` calls, with `request()` reading a module-level variable, OR have callers pass the token in `init.headers`. Preserve the existing `ApiError`/`res.ok`/204-handling logic (lines 24-34) unchanged; add a 401-triggers-`AuthContext`-clear hook similar to how `ApiError` is already thrown and caught by `useResource.ts` (line 28).

---

### `apps/frontend/src/App.tsx` (modify — add `/login` route + wrap in `RequireAuth`)

**Analog:** same file, existing `<Routes>` tree (full file, 41 lines — read in full above)

**Current pattern** (lines 21-34):
```tsx
<Routes>
  <Route element={<AppShell />}>
    <Route path="/" element={<DashboardPage />} />
    ...
  </Route>
</Routes>
```
**Apply:**
```tsx
<Routes>
  <Route path="/login" element={<LoginPage />} />
  <Route element={<RequireAuth />}>
    <Route element={<AppShell />}>
      <Route path="/" element={<DashboardPage />} />
      ...unchanged
    </Route>
  </Route>
</Routes>
```
Wrap `AuthProvider` around `<ToastProvider>`/`<BrowserRouter>` at the top level, matching the existing provider-nesting convention (`ToastProvider` already wraps `BrowserRouter`, line 19-20).

---

## Shared Patterns

### `asyncHandler` wrapper (apply to all new controller functions)
**Source:** `apps/backend/src/utils/asyncHandler.ts` (full file, 8 lines)
```typescript
export const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    handler(req, res, next).catch(next);
  };
```
**Apply to:** every function in `auth.controller.ts` (`login`, `refresh`, `logout`) — wrap exactly like every existing controller does. Never write manual `try/catch` inside handlers.

### `HttpError` + centralized `errorHandler` (apply to all new backend error paths)
**Source:** `apps/backend/src/middleware/errorHandler.ts` (full file, 33 lines)
```typescript
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  ...
}
```
**Apply to:** `requireAuth` middleware (`next(new HttpError(401, ...))`), and every auth controller failure path (`throw new HttpError(401, "Invalid username or password")`, etc.). This is already globally mounted in `index.ts` (`app.use(errorHandler)`) — no new wiring needed, just use the existing class/pattern.

### `prisma` singleton import (apply to all new models)
**Source:** `apps/backend/src/lib/prisma.ts` (full file, 3 lines)
```typescript
import { PrismaClient } from "@prisma/client";
export const prisma = new PrismaClient();
```
**Apply to:** `user.model.ts`, `refreshToken.model.ts` — `import { prisma } from "../lib/prisma.js";` exactly like every existing model.

### `createResourceApi<T>` + `request()` frontend API pattern (does NOT apply to auth — noted for contrast)
**Source:** `apps/frontend/src/api/client.ts` lines 37-49
Existing resource pages use `createResourceApi<T>(resourcePath)` for CRUD. Auth is not a CRUD resource, so `LoginPage`/`AuthContext` should call `request()` directly (or raw `fetch` for `/auth/refresh` per RESEARCH.md's mount-time bootstrap) rather than `createResourceApi`, but should still reuse `ApiError` for consistent error surfacing.

### Route mounting via `apiRoutes.use(path, router)` (apply to `auth.routes.ts` mounting)
**Source:** `apps/backend/src/routes/index.ts` (full file, 27 lines)
```typescript
import { categoryRoutes } from "./category.routes.js";
export const apiRoutes = Router();
apiRoutes.use("/categories", categoryRoutes);
```
**Apply to:** mounting `authRoutes` at `/auth`, and later the single `apiRoutes.use(requireAuth)` enforcement line per D-08 staged rollout — this is the one file where Wave 1 and Wave 3 changes both land, but as two separate commits/waves, not one.

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/backend/src/middleware/rateLimiter.ts` | middleware | request-response | No rate-limiting code exists anywhere in the codebase (confirmed via `.planning/codebase/CONCERNS.md`); use RESEARCH.md's Code Examples section directly, following `errorHandler.ts`'s file-shape convention only |
| `apps/backend/tests/*.test.ts` (6 files), `vitest.config.ts`, `tests/setup.ts` | test/config | request-response | Zero test tooling or test files exist anywhere in either `apps/backend` or `apps/frontend` (`.planning/codebase/CONCERNS.md` confirms); this is genuinely new groundwork — use RESEARCH.md's Validation Architecture section (Wave 0 Gaps) as the sole guide |
| `apps/frontend/src/auth/AuthContext.tsx` (React Context specifically) | provider | request-response | No React Context provider exists anywhere in the frontend today (codebase uses only local/hook state, per RESEARCH.md's "Established Patterns" and CONTEXT.md's code_context section) — `useResource.ts` is the closest state-management analog but is a hook, not a Context; this is a new architectural element introduced deliberately by D-01 |

## Metadata

**Analog search scope:** `apps/backend/src/{controllers,models,routes,middleware,lib,utils}`, `apps/backend/prisma/{schema.prisma,seed.ts}`, `apps/backend/src/index.ts`, `apps/frontend/src/{api,hooks,components,pages,App.tsx}`
**Files scanned:** 12 backend source files + schema.prisma + seed.ts + package.json, 7 frontend source files
**Pattern extraction date:** 2026-09-03
