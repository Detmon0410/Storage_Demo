# External Integrations

**Analysis Date:** 2026-09-03

## APIs & External Services

**Internal API Only:**
- No third-party external APIs detected
- Backend exposes REST API at `/api/*` endpoints for frontend consumption
- Communication uses standard HTTP with JSON payloads

**API Endpoints Available:**
- `/health` - Health check endpoint
- `/api/categories` - Category CRUD operations
- `/api/suppliers` - Supplier CRUD operations
- `/api/products` - Product CRUD operations
- `/api/stock-transactions` - Stock transaction CRUD operations
- `/api/import-orders` - Import order CRUD operations
- `/api/licenses` - License CRUD operations
- `/api/customers` - Customer CRUD operations
- `/api/customer-licenses` - Customer license CRUD operations
- `/api/sales-orders` - Sales order CRUD operations
- `/api/inventory-stocks` - Inventory stock CRUD operations
- `/api/dashboard-kpis` - Dashboard KPI CRUD operations

Reference: `apps/backend/api-test-routes.csv` contains sample request bodies and expected status codes for testing

## Data Storage

**Databases:**
- MySQL 5.7+ (or MariaDB equivalent)
  - Connection: Configured via `DATABASE_URL` environment variable
  - Client: Prisma Client (`@prisma/client` 6.4.1)
  - Schema location: `apps/backend/prisma/schema.prisma`
  - Tables: categories, suppliers, products, stock_transactions, import_orders, licenses, customers, customer_licenses, sales_orders, sales_order_items, inventory_stock, dashboard_kpis

**File Storage:**
- Local filesystem only
- Customer license document reference via `documentUrl` field (stored as string URL, actual storage not handled by application)

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- Custom implementation (not detected in code)
- No third-party auth provider (Supabase, Auth0, Firebase, etc.) integrated
- Backend uses CORS to allow cross-origin requests from frontend
- CORS configured with default settings: `cors()` middleware in `apps/backend/src/index.ts`

## Monitoring & Observability

**Error Tracking:**
- Not integrated (no Sentry, Datadog, or similar service)

**Logs:**
- Console logging only
- Backend logs startup message to stdout: `Backend listening on http://{host}:{port}`
- No persistent logging infrastructure

**Metrics:**
- Dashboard KPI data stored in `DashboardKpi` table (`apps/backend/prisma/schema.prisma`)
- Manual collection via business logic, not automated monitoring

## CI/CD & Deployment

**Hosting:**
- Not configured
- Application designed to run locally or on-premises
- Supports custom `--host` flag for network binding (see `apps/backend/src/index.ts`)

**CI Pipeline:**
- Not detected (no GitHub Actions, GitLab CI, Jenkins config files)

**Deployment Scripts:**
- Root monorepo script `pnpm host` triggers hosting mode in both apps
- Backend `pnpm host` accepts `--host` argument to bind to specific IP address
- Frontend `pnpm host` serves at `/useradmin/` base path for hosting scenario

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` - MySQL connection string (format: `mysql://user:password@host:port/database`)
- `PORT` - Backend server port (default: 4000 if not set)
- `HOST` - Backend server hostname (default: 127.0.0.1, can be overridden with `--host` CLI arg)
- `VITE_API_BASE_URL` - Frontend API base URL (default: `/api`, configured in `apps/frontend/.env.development`)

**Secrets location:**
- `.env` file in `apps/backend/` directory (gitignored, copy from `.env.example`)
- Frontend development overrides in `apps/frontend/.env.development` (no secrets, only public values)
- Actual `.env` files are NOT committed to git repository

## Webhooks & Callbacks

**Incoming:**
- Not detected

**Outgoing:**
- Not detected

## Database Seeding

**Seed Data Location:**
- `apps/backend/prisma/seed.ts` - TypeScript seed script
- Initialized via `pnpm db:seed` command
- Loads demo liquor import data:
  - SKUs (products with categories and suppliers)
  - Import orders and items
  - Licenses and customer licenses
  - Customers and sales orders
  - Inventory lots and stock transactions
  - Dashboard KPIs

**SQL Schema:**
- `apps/backend/prisma/sql/init.sql` - Alternative manual schema initialization (for non-migration environments)

## Frontend-to-Backend Communication

**HTTP Client:** Native Fetch API (no axios, superagent, or similar library)

**Implementation Details:**
- Location: `apps/frontend/src/api/client.ts`
- Custom `request()` function wraps fetch for type-safe API calls
- Custom `ApiError` class extends Error with HTTP status code
- Error messages use i18n translations (`i18n.t()`)
- Base URL construction: `${BASE_URL}${path}` where BASE_URL defaults to `/api`
- CORS headers automatically sent by browser; backend allows all origins via `cors()` middleware

**Resource API Pattern:**
- Generic resource API factory: `createResourceApi<T>()` in `apps/frontend/src/api/client.ts`
- Provides standard CRUD operations: `list()`, `get(id)`, `create()`, `update()`, `remove()`
- Used across all data models via `apps/frontend/src/api/resources.ts`

---

*Integration audit: 2026-09-03*
