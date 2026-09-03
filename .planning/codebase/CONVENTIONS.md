# Coding Conventions

**Analysis Date:** 2026-09-03

## Naming Patterns

**Files:**
- Backend controllers: `[EntityName].controller.ts` (e.g., `product.controller.ts`)
- Backend models: `[EntityName].model.ts` (e.g., `product.model.ts`)
- Backend routes: `[entityName].routes.ts` (e.g., `product.routes.ts`)
- Frontend pages: `[EntityName]Page.tsx` (e.g., `ProductsPage.tsx`)
- Frontend components: `[ComponentName].tsx` - PascalCase (e.g., `Button.tsx`, `Modal.tsx`)
- Frontend utilities: `[utility].ts` - camelCase (e.g., `format.ts`, `useResource.ts`)
- Frontend hooks: `use[HookName].ts` - camelCase with `use` prefix (e.g., `useResource.ts`, `useList.ts`)

**Functions:**
- All functions use camelCase (e.g., `listProducts`, `createProduct`, `formatCurrency`)
- Async handlers in controllers: `[action][Entity]` (e.g., `listProducts`, `getProduct`)
- React component functions: PascalCase, exported as named exports (e.g., `export function ProductsPage()`)
- Custom hooks: `use` prefix + PascalCase (e.g., `useResource`, `useList`)

**Variables:**
- Local variables: camelCase (e.g., `productId`, `categoryName`, `isLoading`)
- State variables: camelCase (e.g., `const [rows, setRows]`, `const [search, setSearch]`)
- Constants in components: UPPER_CASE or camelCase depending on scope
  - Component-level constants: UPPER_CASE (e.g., `STATUS_OPTIONS = ["READY", "LOW_STOCK", ...]`)
  - Exported utility constants: camelCase (e.g., `CURRENCY_SYMBOLS: Record<string, string>`)

**Types:**
- Interfaces/Types: PascalCase (e.g., `FormState`, `Product`, `ResourceApi`)
- Type imports: Use TypeScript `type` keyword (e.g., `import type { ReactNode } from "react"`)

## Code Style

**Formatting:**
- No explicit formatter configured (rely on TypeScript compiler and ESLint)
- 2-space indentation (inferred from codebase)
- Semicolons: Used throughout
- String quotes: Double quotes for strings, type annotations

**Linting:**
- Frontend: ESLint with TypeScript and React plugins
  - Config: `apps/frontend/eslint.config.js`
  - Enabled: `js.configs.recommended`, `tseslint.configs.recommended`
  - React Hooks: `reactHooks.configs.flat.recommended`
  - React Refresh: `reactRefresh.configs.vite`
- Backend: No linter configured (TypeScript strict mode enforces quality)

**TypeScript Configuration:**
- Backend (`apps/backend/tsconfig.json`):
  - Target: `ES2022`
  - Module: `NodeNext`
  - Strict mode: Enabled
  - Requires explicit type annotations
- Frontend (`apps/frontend/tsconfig.app.json`):
  - Target: `es2023`
  - Bundler mode with `noUnusedLocals` and `noUnusedParameters`
  - JSX: `react-jsx`
  - `verbatimModuleSyntax` enabled for strict imports

## Import Organization

**Order:**
1. External packages (React, libraries, framework)
2. Type imports from external packages (`import type { ... }`)
3. Relative imports from application code
4. Type imports from application code (`import type { ... }`)

**Example from `ProductsPage.tsx`:**
```typescript
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { categoryApi, productApi, supplierApi } from "../api/resources";
import type { Product } from "../api/types";
import { Badge } from "../components/ui/Badge";
// ... more relative imports
import { useList } from "../hooks/useList";
import { useResource } from "../hooks/useResource";
```

**Extensions:**
- Always include `.js` extension in backend imports (ES module compatibility)
  - Example: `import { errorHandler } from "./middleware/errorHandler.js"`
- Frontend imports omit extensions (bundler handles resolution)

## Error Handling

**Patterns:**
- **Backend custom error class** (`src/middleware/errorHandler.ts`):
  - Use `HttpError` class for throwing application errors
  - Constructor: `new HttpError(status: number, message: string)`
  - Example: `throw new HttpError(404, "Product not found")`

- **Error wrapping with asyncHandler** (`src/utils/asyncHandler.ts`):
  - All async route handlers wrapped in `asyncHandler` to catch errors
  - Automatically forwards errors to Express error middleware
  - Example: `export const listProducts = asyncHandler(async (_req, res) => { ... })`

- **Backend error handler middleware**:
  - Catches `HttpError` → responds with custom status/message
  - Catches `Prisma.PrismaClientKnownRequestError` → handles specific codes
    - `P2025`: Returns 404 "Record not found"
    - `P2002`: Returns 409 "Record already exists"
    - `P2003`: Returns 409 "Record referenced by other data"
  - Falls through: Logs error, returns 500 "Internal server error"

- **Frontend API error class** (`src/api/client.ts`):
  - Use `ApiError` class for HTTP response errors
  - Constructor: `new ApiError(status: number, message: string)`
  - Caught in hooks and handled with toast notifications

**Validation pattern:**
- Happens in controller layer, before model operations
- Check required fields: `if (!productCode || !productName || ...) throw new HttpError(400, "...")`
- Return early with errors, throw exceptions

## Logging

**Framework:** `console` (no logging library)

**Patterns:**
- **Backend**: Only `console.error(err)` in error handler middleware
  - Called when unhandled errors occur
  - Path: `apps/backend/src/middleware/errorHandler.ts`
- **Frontend**: No explicit logging visible
  - App relies on browser console for debugging
- **Startup logging**: Backend logs server startup message
  - `console.log(\`Backend listening on http://...\`)`

**Best practices observed:**
- Minimal logging (errors only)
- Server startup confirmation in console
- No debug logs in controllers/models

## Comments

**When to Comment:**
- Based on codebase analysis: No JSDoc or comment blocks observed
- Code is self-documenting through:
  - Clear naming (`listProducts`, `createProduct`)
  - Type annotations (`Product`, `FormState`)
  - Small, focused functions

**JSDoc/TSDoc:**
- Not used in this codebase
- Type information from TypeScript interfaces/types instead
- Consider adding JSDoc for complex utilities or public APIs if needed

## Function Design

**Size:**
- Controllers: Small, single-responsibility functions (5-15 lines)
- Models: Single-method objects, 2-5 lines per operation
- React components: Mixed (pages are larger with state management, reusable components are small)

**Parameters:**
- Backend controllers: `(req: Request, res: Response)` - wrapped in asyncHandler
- Backend models: Strongly typed using TypeScript interfaces
  - Example: `create: (data: { productCode: string; productName: string; ... })`
- Frontend components: Destructured props with inline type definition
  - Example: `export function Button({ variant = "secondary", size = "md", ... }: ButtonProps)`
- Custom hooks: Generic factory pattern
  - Example: `useResource<T, TCreate, TUpdate>(api: ResourceApi<T, TCreate, TUpdate>, getId: (row: T) => number)`

**Return Values:**
- Backend controllers: Always respond with `res.json()` or `res.status().json()` or `res.status().end()`
- Backend models: Return Prisma query results (Promise types)
- React components: Return JSX elements
- Custom hooks: Return object with methods and state (e.g., `{ rows, loading, error, saving, reload, create, update, remove }`)

## Module Design

**Exports:**
- Backend: Named exports for functions and classes
  - Controllers: `export const listProducts = ...`, `export const createProduct = ...`
  - Models: `export const ProductModel = { findAll: ..., create: ..., ... }`
  - Middleware/Utils: `export class HttpError`, `export const asyncHandler = ...`
- Frontend: Named exports for components and utilities
  - Components: `export function Button({ ... }) { ... }`
  - Utilities: `export function formatCurrency(...) { ... }`
  - Hooks: `export function useResource(...) { ... }`

**Barrel Files:**
- Backend routes: `src/routes/index.ts` imports and re-exports all route modules
  - Pattern: `import { productRoutes } from "./product.routes.js"`
- Frontend API: `src/api/resources.ts` exports API instances
  - Pattern: `export const productApi = createResourceApi<Product>("api/products")`

**Re-exports:**
- Used minimally for public API surfaces
- Routes consolidated in single entry point
- API clients bundled in resources file

## State Management

**Frontend patterns:**
- React `useState` for local component state
- Custom generic hooks (`useResource`, `useList`) for data fetching and CRUD
- State organized by concern (rows, loading, error, saving)
- Form state as typed object (`FormState` type)
- Filtered results computed with `useMemo`

**Backend patterns:**
- Prisma client for database queries and state persistence
- In-memory caching: None observed
- Stateless request handlers (functional approach)

## Type Safety

**Backend:**
- Strict TypeScript enabled
- All function parameters typed
- No implicit `any` types
- Prisma-generated types used for database entities

**Frontend:**
- TypeScript strict mode equivalent settings
- React component prop types defined (inline or separate interface)
- API response types defined in `src/api/types.ts`
- Generic type parameters for reusable hooks and factories

---

*Convention analysis: 2026-09-03*
