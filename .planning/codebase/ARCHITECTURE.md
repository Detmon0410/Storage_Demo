# Architecture

**Analysis Date:** 2026-09-03

## Pattern Overview

**Overall:** Monorepo with layered three-tier architecture (MVC pattern on backend, component-based on frontend).

**Key Characteristics:**
- Monorepo with separate `backend` (Express/Node) and `frontend` (React/Vite) applications
- Clear separation between API routes, business logic (models), and HTTP handlers (controllers)
- API-driven frontend with centralized resource management hooks
- Prisma ORM for all database operations with transaction support
- Domain-driven route organization (categories, suppliers, products, orders, licenses, customers, etc.)

## Layers

**HTTP Handler Layer (Controllers):**
- Purpose: Handle incoming HTTP requests, validate input, delegate to models, format responses
- Location: `apps/backend/src/controllers/`
- Contains: Request validation, parameter parsing, response wrapping, error handling with asyncHandler
- Depends on: Models, HttpError middleware
- Used by: Routes

**Business Logic Layer (Models):**
- Purpose: Encapsulate all data operations, transactions, and business rules through Prisma
- Location: `apps/backend/src/models/`
- Contains: Data access methods (find, create, update, delete), complex queries, transactions, computed fields
- Depends on: Prisma client, middleware/errorHandler for HttpError
- Used by: Controllers

**Route Layer:**
- Purpose: Map HTTP methods and paths to controller handlers
- Location: `apps/backend/src/routes/`
- Contains: Express router definitions organized by resource domain
- Depends on: Controllers
- Used by: Express app (main entry point)

**Persistence Layer:**
- Purpose: Database schema definition and Prisma client initialization
- Location: `apps/backend/prisma/schema.prisma`, `apps/backend/src/lib/prisma.ts`
- Contains: Prisma schema with models and relationships, singleton Prisma client
- Depends on: PostgreSQL/MySQL database

**Frontend API Client Layer:**
- Purpose: Abstract HTTP communication and error handling
- Location: `apps/frontend/src/api/`
- Contains: `client.ts` (fetch wrapper), `resources.ts` (resource-specific APIs), `types.ts` (TypeScript interfaces)
- Depends on: i18n for error messages
- Used by: Components and hooks

**Frontend State Management Layer:**
- Purpose: Manage data fetching, caching, and state updates for resources
- Location: `apps/frontend/src/hooks/`
- Contains: `useResource` hook (full CRUD state management), `useList` hook (read-only lists)
- Depends on: API client
- Used by: Pages

**Frontend Component Layer:**
- Purpose: Render UI and handle user interactions
- Location: `apps/frontend/src/components/` and `apps/frontend/src/pages/`
- Contains: Layout shell, reusable UI components, page-level containers
- Depends on: Hooks, API types, i18n
- Used by: App router

**Middleware Layer:**
- Purpose: Cross-cutting concerns and error handling
- Location: `apps/backend/src/middleware/`
- Contains: `errorHandler.ts` (centralized error handling with Prisma error mapping)
- Depends on: Express, Prisma error types

**Utility Layer:**
- Purpose: Reusable helper functions and adapters
- Location: `apps/backend/src/utils/`, `apps/frontend/src/lib/`
- Backend: `asyncHandler` (async route handler wrapper), `stockReference` (reference number generation)
- Frontend: Format utilities, status mapping, i18n

## Data Flow

**Create/Update/Delete Flow (Import Order Example):**

1. User submits form in `ImportOrdersPage.tsx`
2. Page calls `api.create()` via `useResource` hook
3. Hook calls `importOrderApi.create()` from `apps/frontend/src/api/resources.ts`
4. Client makes POST request to `/api/import-orders` via `request()` in `client.ts`
5. Express routes to `POST /api/import-orders` → `importOrderRoutes`
6. Route handler calls `createImportOrder` controller
7. Controller validates input (orderNo, supplierId, items array, etc.)
8. Controller calls `ImportOrderModel.create()` with parsed data
9. Model executes Prisma transaction:
   - Creates ImportOrder record with items via nested create
   - Calculates totalValue and skuItemCount
   - Calls `createStockInTx()` to auto-generate IN stock transactions
   - Returns order with supplier and item relations included
10. Controller wraps response and sends 201 Created
11. Hook updates local state and returns updated resource to page
12. Page refreshes table and shows success toast

**Read Flow:**

1. Page loads, `useResource` hook executes automatically via useEffect
2. Hook calls `api.list()` 
3. Client makes GET request to `/api/resource-name`
4. Route handler calls controller's list function
5. Controller calls `Model.findAll()` which executes Prisma query with relations
6. Response returned to hook, state updated
7. Page renders data table with results

**State Management:**

- Backend: Stateless. State only in database via Prisma.
- Frontend: Local component state (modals, forms) + hook state (CRUD data). No Redux/global store.
- Database transactions used for multi-step operations (import orders cascade to stock transactions, license renewals maintain references)

## Key Abstractions

**HttpError (Custom Error Class):**
- Purpose: Standardized error responses with HTTP status codes
- Examples: `apps/backend/src/middleware/errorHandler.ts`
- Pattern: Thrown in controllers/models, caught by errorHandler middleware, mapped to JSON responses with 4xx/5xx codes

**asyncHandler (Async Wrapper):**
- Purpose: Catch async errors in route handlers and pass to Express error middleware
- Examples: `apps/backend/src/utils/asyncHandler.ts`
- Pattern: Wraps all controller functions to convert promise rejections to middleware errors

**ResourceModel Pattern:**
- Purpose: Encapsulate CRUD operations as a static object with methods
- Examples: `CategoryModel`, `ImportOrderModel`, `SalesOrderModel`
- Pattern: Each model is an object with `findAll()`, `findById()`, `create()`, `update()`, `delete()` methods
- Complex models use transactions (`prisma.$transaction()`) for atomic multi-step operations

**useResource Hook:**
- Purpose: Generic CRUD state management for any API resource
- Examples: `apps/frontend/src/hooks/useResource.ts`
- Pattern: Accepts ResourceApi and getId function, returns `{ rows, loading, error, saving, reload, create, update, remove, setRows }`
- Automatically loads on mount, synchronizes local state with server operations

**API Resource Factory:**
- Purpose: Generate typed resource APIs from a path
- Examples: `apps/frontend/src/api/client.ts` - `createResourceApi()`
- Pattern: Takes resource path, returns object with `list()`, `get()`, `create()`, `update()`, `remove()` methods

## Entry Points

**Backend Server:**
- Location: `apps/backend/src/index.ts`
- Triggers: `npm run dev` or `npm start`
- Responsibilities: 
  - Load environment variables via dotenv
  - Initialize Express app with CORS and JSON middleware
  - Mount API routes at `/api` prefix
  - Mount error handler middleware
  - Listen on HOST:PORT (default 127.0.0.1:4000)

**Frontend Application:**
- Location: `apps/frontend/src/main.tsx`
- Triggers: Vite dev server or build
- Responsibilities:
  - Import i18n configuration
  - Render React app to DOM root element
  - Mount App component which sets up routing

**App Router (Frontend):**
- Location: `apps/frontend/src/App.tsx`
- Responsibilities:
  - Define route tree with React Router v7
  - Mount AppShell layout with Outlet for nested pages
  - Configure all page routes (dashboard, imports, products, customers, etc.)

## Error Handling

**Strategy:** Centralized error handler middleware on backend; thrown errors caught and standardized. Frontend catches ApiError and translates to user messages.

**Patterns:**

**Backend Error Mapping:**
- `HttpError` - Custom class thrown by controllers/models with status + message
- `Prisma.PrismaClientKnownRequestError` - Specific Prisma errors mapped:
  - P2025 (record not found) → 404
  - P2002 (unique constraint) → 409 conflict
  - P2003 (foreign key constraint) → 409 conflict
- Unhandled errors → 500 internal server error (logged to console)

**Frontend Error Handling:**
- `ApiError` class in `client.ts` has status code for distinguishing error types
- Controller functions use try/catch, calling `toast.error()` with localized message from `i18n.t()`
- LoadingState, ErrorState components for displaying fetch errors in UI

## Cross-Cutting Concerns

**Logging:** 
- Backend: Manual `console.error()` in errorHandler for unhandled exceptions
- Frontend: Relies on browser dev tools; no structured logging

**Validation:** 
- Backend: Controller-level input validation (required fields, type coercion)
- Frontend: Required form fields via HTML5 validation; no client-side schema validation library

**Authentication:** 
- Not implemented. No auth middleware or login flow.

**Internationalization (i18n):**
- Frontend: i18next with react-i18next
- Files: `apps/frontend/src/i18n/index.ts`, locales in `apps/frontend/src/i18n/locales/`
- Usage: `const { t } = useTranslation()` in components, `t("key.path", { param: value })`
- Currently supports multiple languages (detected via browser language detector)

**CORS:**
- Backend: Express cors() middleware enabled globally (no restrictions)

---

*Architecture analysis: 2026-09-03*
