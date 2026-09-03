# Codebase Structure

**Analysis Date:** 2026-09-03

## Directory Layout

```
storage-demo/
├── apps/
│   ├── backend/                          # Express server (Node.js/TypeScript)
│   │   ├── src/
│   │   │   ├── controllers/              # HTTP request handlers
│   │   │   ├── models/                   # Data access & business logic
│   │   │   ├── routes/                   # Express route definitions
│   │   │   ├── middleware/               # Express middleware (error handling)
│   │   │   ├── lib/                      # Shared libraries (Prisma client)
│   │   │   ├── utils/                    # Helper utilities
│   │   │   └── index.ts                  # Server entry point
│   │   ├── prisma/
│   │   │   ├── schema.prisma             # Database schema
│   │   │   ├── migrations/               # Database migration history
│   │   │   ├── seed.ts                   # Database seeding script
│   │   │   └── sql/                      # Raw SQL queries (if any)
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── frontend/                          # React application (Vite)
│       ├── src/
│       │   ├── api/                      # API client & types
│       │   │   ├── client.ts             # Fetch wrapper
│       │   │   ├── resources.ts          # Resource-specific API definitions
│       │   │   └── types.ts              # TypeScript interfaces for API responses
│       │   ├── components/               # React components
│       │   │   ├── layout/               # Layout components (AppShell, Sidebar, Topbar)
│       │   │   └── ui/                   # Reusable UI components (Button, Modal, DataTable, etc.)
│       │   ├── pages/                    # Page components (routes)
│       │   │   └── customers/            # Customer-specific sub-pages
│       │   ├── hooks/                    # Custom React hooks
│       │   ├── i18n/                     # Internationalization
│       │   │   └── locales/              # Language translation files
│       │   ├── lib/                      # Utility functions
│       │   ├── App.tsx                   # Root component with routing
│       │   ├── main.tsx                  # React entry point
│       │   └── index.css                 # Global styles
│       ├── public/                       # Static assets
│       ├── package.json
│       └── tsconfig.json
│
├── scripts/                               # Utility scripts
│   └── host.mjs                          # Host script for network access
│
├── .planning/                             # Planning documentation
│   └── codebase/                         # Generated codebase maps
│
├── .vscode/                              # VS Code workspace settings
├── .claude/                              # Claude-specific configurations
├── pnpm-workspace.yaml                   # Monorepo workspace config
├── package.json                          # Root package (scripts only)
├── pnpm-lock.yaml                        # Dependency lock file
└── README.md                             # Project documentation
```

## Directory Purposes

**Backend (`apps/backend/src/`):**

**controllers/:**
- Purpose: HTTP request handlers that process input and delegate to models
- Contains: One file per resource (e.g., `category.controller.ts`, `importOrder.controller.ts`)
- Functions: `list*`, `get*`, `create*`, `update*`, `delete*` (exported as named exports)
- Pattern: All wrapped with `asyncHandler()` to catch promise rejections
- Key files: 
  - `category.controller.ts` - Basic CRUD pattern
  - `importOrder.controller.ts` - Complex validation and nested item parsing
  - `salesOrder.controller.ts` - License snapshot logic
  - `customerLicense.controller.ts` - License renewal and status management

**models/:**
- Purpose: Data access layer encapsulating all Prisma operations
- Contains: One file per resource (e.g., `category.model.ts`, `salesOrder.model.ts`)
- Pattern: Each model is an object with methods `findAll()`, `findById()`, `create()`, `update()`, `delete()`
- Transactions: Complex models use `prisma.$transaction()` for atomic operations
- Relations: Models include related data via Prisma `include` objects
- Key files:
  - `importOrder.model.ts` - Transaction-based creation (order + items + auto stock transactions)
  - `salesOrder.model.ts` - Multi-step order processing with license snapshots
  - `stockTransaction.model.ts` - Reference-based transaction reversal and audit
  - `customerLicense.model.ts` - License renewal chain management

**routes/:**
- Purpose: Express router definitions mapping HTTP paths to controllers
- Contains: One file per resource (e.g., `category.routes.ts`)
- Pattern: Each resource router imports controller functions and mounts them on GET/POST/PUT/DELETE endpoints
- Route paths follow RESTful convention: `/resource`, `/resource/:id`
- Central index: `routes/index.ts` mounts all resource routers under `/api` prefix
- Key files:
  - `index.ts` - Composes all resource routes, mounted at `/api` in main index.ts

**middleware/:**
- Purpose: Express middleware for cross-cutting concerns
- Contains: `errorHandler.ts` - Global error handler
- Pattern: Must be registered last in Express (after all route handlers)
- Handles: HttpError, Prisma errors (mapped to 4xx), unhandled errors (5xx)

**lib/:**
- Purpose: Singleton instances and shared libraries
- Contains: `prisma.ts` - Prisma client instance (singleton)
- Usage: Imported by all models to access database

**utils/:**
- Purpose: Reusable utility functions
- Contains: 
  - `asyncHandler.ts` - Wraps async route handlers to catch errors
  - `stockReference.ts` - Generates stock transaction reference numbers

**Frontend (`apps/frontend/src/`):**

**api/:**
- Purpose: HTTP client and API type definitions
- Contains:
  - `client.ts` - Fetch wrapper with error handling
  - `resources.ts` - Factory function to create resource APIs for each endpoint
  - `types.ts` - TypeScript interfaces for all API response types
- Pattern: All API calls use `createResourceApi<T>()` factory with path
- Error handling: ApiError class with status codes; connection errors translated to i18n messages

**components/layout/:**
- Purpose: Main layout components
- Contains:
  - `AppShell.tsx` - Root layout with sidebar + outlet
  - `Sidebar.tsx` - Navigation menu
  - `Topbar.tsx` - Header with user/settings
  - `LanguageSwitcher.tsx` - i18n language selector

**components/ui/:**
- Purpose: Reusable UI components
- Contains: 
  - `DataTable.tsx` - Sortable/searchable table with columns
  - `Modal.tsx` - Dialog for forms/confirmations
  - `Field.tsx` - Form inputs (TextInput, TextareaField, CheckboxField, SelectField)
  - `Button.tsx` - Button component
  - `Badge.tsx` - Status badge
  - `Toast.tsx` - Toast notifications (context + provider)
  - `States.tsx` - LoadingState, ErrorState, EmptyState components
  - `PageHeader.tsx` - Page title + action buttons
  - `SearchInput.tsx` - Search field
  - `Card.tsx` - Card container
  - `StatCard.tsx` - Dashboard stat display
  - `ConfirmDialog.tsx` - Confirmation modal

**pages/:**
- Purpose: Page-level containers mounted in routing
- Contains: One file per route (e.g., `DashboardPage.tsx`, `ProductsPage.tsx`)
- Pattern: Each page uses `useResource` hook for CRUD, renders DataTable + Modal for forms
- Structure:
  - Import hook and API client
  - Define form state type
  - Initialize useResource, useToast hooks
  - Manage form/modal/confirmation state with useState
  - Render header, search, table, modal, confirm dialog
- Key files:
  - `DashboardPage.tsx` - KPI cards and summary stats
  - `ImportOrdersPage.tsx` - Complex import workflow with items
  - `SalesOrdersPage.tsx` - Order creation with license validation
  - `CustomersPage.tsx` - Customer management with license list
  - `ProductsPage.tsx` - Product CRUD with category/supplier selects

**hooks/:**
- Purpose: Custom React hooks for data management
- Contains:
  - `useResource.ts` - Generic CRUD state management (list, create, update, delete)
  - `useList.ts` - Simple read-only list fetching
- Pattern: Hooks manage loading, error, saving states; auto-fetch on mount
- useResource return: `{ rows, loading, error, saving, reload, create, update, remove, setRows }`

**i18n/:**
- Purpose: Internationalization configuration and translations
- Contains:
  - `index.ts` - i18next initialization with language detector
  - `locales/` - Translation JSON files per language (e.g., `en.json`, `es.json`, `ja.json`)
- Usage: `const { t } = useTranslation()` in components, `t("key.path")` for lookup
- Structure: Nested key hierarchy (e.g., `category.toast.created`, `common.saveFailed`)

**lib/:**
- Purpose: Frontend utility functions
- Contains: Format utilities, status tone mapping, number/currency formatting
- Usage: Imported in pages and components for data formatting

## Key File Locations

**Entry Points:**

**Backend:**
- `apps/backend/src/index.ts` - Express server initialization, CORS setup, route mounting, error handler registration

**Frontend:**
- `apps/frontend/src/main.tsx` - React DOM render entry point
- `apps/frontend/src/App.tsx` - Router and route definitions

**Configuration:**

**Backend:**
- `apps/backend/package.json` - Scripts, dependencies (Express, Prisma, tsx)
- `apps/backend/tsconfig.json` - TypeScript config (ESM module)
- `apps/backend/prisma/schema.prisma` - Database schema and Prisma models
- `apps/backend/.env` - DATABASE_URL, PORT, HOST (not in git)

**Frontend:**
- `apps/frontend/package.json` - Scripts, dependencies (React, Vite, Tailwind)
- `apps/frontend/vite.config.ts` - Vite build config (if present)
- `apps/frontend/tailwind.config.ts` - Tailwind CSS config (if present)
- `apps/frontend/eslint.config.mjs` - ESLint rules

**Root:**
- `pnpm-workspace.yaml` - Defines workspace with `apps/*` and `scripts/` directories
- `package.json` - Root scripts for dev/build all apps

**Core Logic:**

**Backend:**
- `apps/backend/src/routes/index.ts` - Composes all resource routers
- `apps/backend/src/models/` - All data operations (ImportOrderModel, SalesOrderModel, CustomerLicenseModel, etc.)
- `apps/backend/src/middleware/errorHandler.ts` - Centralized error handling

**Frontend:**
- `apps/frontend/src/api/client.ts` - Fetch wrapper and ApiError class
- `apps/frontend/src/api/resources.ts` - Resource API instances
- `apps/frontend/src/hooks/useResource.ts` - Generic CRUD state management
- `apps/frontend/src/components/layout/AppShell.tsx` - Main layout structure

**Testing:**
- Not implemented. No test files in codebase.

## Naming Conventions

**Files:**

**Backend:**
- Controllers: `{resource}.controller.ts` (e.g., `product.controller.ts`)
- Models: `{resource}.model.ts` (e.g., `salesOrder.model.ts`)
- Routes: `{resource}.routes.ts` (e.g., `customer.routes.ts`)
- Middleware: `{concern}.ts` (e.g., `errorHandler.ts`)
- Utils: `{function}.ts` (e.g., `asyncHandler.ts`)

**Frontend:**
- Pages: `{PascalCase}Page.tsx` (e.g., `ProductsPage.tsx`, `CustomersPage.tsx`)
- Components: `{PascalCase}.tsx` (e.g., `DataTable.tsx`, `Modal.tsx`)
- Hooks: `use{PascalCase}.ts` (e.g., `useResource.ts`, `useList.ts`)
- Utilities: `{camelCase}.ts` (e.g., `format.ts`, `status.ts`)

**Directories:**
- camelCase for feature/concept groups: `controllers`, `models`, `routes`, `middleware`, `lib`, `utils`
- PascalCase path segment in routes: `/api/import-orders`, `/api/customer-licenses` (kebab-case)

**Functions:**

**Backend:**
- Controller exports: `list{Resource}`, `get{Resource}`, `create{Resource}`, `update{Resource}`, `delete{Resource}`
  - Examples: `listProducts`, `getCategory`, `createImportOrder`, `updateSalesOrder`
- Model methods: camelCase action verbs: `findAll`, `findById`, `create`, `update`, `delete`
- Middleware/utils: camelCase: `errorHandler`, `asyncHandler`
- Transaction helpers: `{action}InTx` or `{action}AndDeleteByReferenceTx`
  - Examples: `createStockInTx`, `reverseAndDeleteByReferenceTx`

**Frontend:**
- React components: PascalCase
- Hook functions: `use{Feature}` (React Hook convention)
- Utility functions: camelCase
- API methods: camelCase: `list()`, `get()`, `create()`, `update()`, `remove()`
- Event handlers: `handle{Action}` (e.g., `handleSubmit`, `handleDelete`)

**Variables:**

**Backend:**
- Data models: PascalCase (e.g., `ImportOrder`, `Product`)
- Database instances: lowercase (e.g., `prisma`)
- Type interfaces: PascalCase (e.g., `ImportOrderItemInput`)

**Frontend:**
- Component props interfaces: `{ComponentName}Props` (e.g., `DataTableProps`, `ButtonProps`)
- State variables: camelCase (e.g., `isLoading`, `errorMessage`)
- Enums/constants: UPPER_SNAKE_CASE (e.g., `TRANSACTION_TYPES`)
- Translation keys: camelCase with dots (e.g., `category.toast.created`)

**Types:**

**Backend:**
- Prisma models: PascalCase singular (e.g., `Product`, `ImportOrder`)
- Input/DTO interfaces: `{EntityName}Input` or `{EntityName}Create`/`{EntityName}Update`
- Error classes: PascalCase with "Error" suffix (e.g., `HttpError`)

**Frontend:**
- API response types: Exact match to backend Prisma model names (e.g., `Product`, `Category`)
- Props interfaces: `{ComponentName}Props` (e.g., `DataTableProps<T>`)
- State types: Descriptive nouns (e.g., `FormState`)

## Where to Add New Code

**New Feature (e.g., Shipments):**

1. **Backend:**
   - Create Prisma model in `apps/backend/prisma/schema.prisma`
   - Generate migration: `pnpm run prisma:migrate`
   - Create `apps/backend/src/models/shipment.model.ts` with CRUD methods
   - Create `apps/backend/src/controllers/shipment.controller.ts` with list/get/create/update/delete handlers
   - Create `apps/backend/src/routes/shipment.routes.ts` with Express router
   - Import and mount router in `apps/backend/src/routes/index.ts`

2. **Frontend:**
   - Add types to `apps/frontend/src/api/types.ts` (import from backend models)
   - Create shipment API in `apps/frontend/src/api/resources.ts`
   - Create `apps/frontend/src/pages/ShipmentsPage.tsx` with useResource hook
   - Add route to `apps/frontend/src/App.tsx`
   - Add sidebar navigation in `apps/frontend/src/components/layout/Sidebar.tsx` if needed

**New Component/Module:**

1. **Reusable Component:**
   - Create `apps/frontend/src/components/ui/{ComponentName}.tsx`
   - Export from component file
   - Use in pages

2. **Layout Component:**
   - Create `apps/frontend/src/components/layout/{ComponentName}.tsx`
   - Import in `AppShell.tsx` or relevant layout

3. **Custom Hook:**
   - Create `apps/frontend/src/hooks/use{Feature}.ts`
   - Export function and types
   - Use in components/pages

**Utilities:**

**Backend:**
- Shared helpers: `apps/backend/src/utils/{function}.ts`
- Import and use in controllers/models

**Frontend:**
- Shared helpers: `apps/frontend/src/lib/{function}.ts`
- Import and use in components/pages/hooks

## Special Directories

**prisma/migrations/:**
- Purpose: Version-controlled database schema history
- Generated: Yes (auto-generated by Prisma migrate dev)
- Committed: Yes (stored in git)
- Usage: Apply migrations via `prisma migrate deploy` in production
- Files: Numbered migrations with `.sql` files describing schema changes

**prisma/sql/:**
- Purpose: Raw SQL queries (if needed beyond Prisma)
- Generated: Manual
- Committed: Yes
- Currently: May be empty

**.planning/codebase/:**
- Purpose: Generated codebase documentation
- Generated: Yes (by GSD mapping tool)
- Committed: Yes
- Files: ARCHITECTURE.md, STRUCTURE.md, CONVENTIONS.md, TESTING.md, CONCERNS.md

**dist/ (not in repo):**
- Purpose: Compiled output
- Generated: Yes (by build scripts)
- Committed: No (.gitignore)

**node_modules/ (not in repo):**
- Purpose: Installed dependencies
- Generated: Yes (by pnpm install)
- Committed: No (.gitignore)

---

*Structure analysis: 2026-09-03*
