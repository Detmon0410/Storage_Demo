# Storage Demo

A pnpm monorepo with two apps:

- **[apps/frontend](apps/frontend)** - React + TypeScript + Vite
- **[apps/backend](apps/backend)** - Express + TypeScript, MVC structure, Prisma ORM (MySQL)

## Prerequisites

- Node.js 20+
- pnpm 9+ (`corepack enable` or `npm i -g pnpm`)
- Access to a MySQL database (connection string for `DATABASE_URL`)

## Setup

1. Install dependencies for both apps from the repo root:

   ```
   pnpm install
   ```

2. Configure the backend's environment file:

   ```
   cp apps/backend/.env.example apps/backend/.env
   ```

   Then edit `apps/backend/.env` and set `DATABASE_URL` to your MySQL connection string, e.g.:

   ```
   DATABASE_URL="mysql://user:password@host:3306/storage_demo"
   PORT=4000
   ```

   `.env` is gitignored. Never commit real credentials.

3. Set up the MySQL schema and seed demo data:

   ```
   pnpm --filter backend db:setup
   ```

   This runs `prisma db push` and then `prisma db seed`.

   For migration-based environments, use:

   ```
   pnpm --filter backend db:deploy
   pnpm --filter backend db:seed
   ```

   For direct MySQL setup without Prisma migrations, use [apps/backend/prisma/sql/init.sql](apps/backend/prisma/sql/init.sql), then run:

   ```
   pnpm --filter backend db:seed
   ```

   The seed script resets the demo tables and loads liquor SKUs, import orders, licenses, customers, sales orders, inventory lots, dashboard KPIs, and stock transactions.

## Running the apps

From the repo root:

| Command       | Runs                                      |
| ------------- | ----------------------------------------- |
| `pnpm dev:be` | Backend only, at `http://localhost:4000`  |
| `pnpm dev:fe` | Frontend only, at `http://localhost:5173` |
| `pnpm dev`    | Both apps in parallel                     |

## Backend Reference

- Health check: `GET http://localhost:4000/health`
- API base path: `http://localhost:4000/api`
- Routes: `/categories`, `/suppliers`, `/products`, `/stock-transactions`, `/import-orders`, `/licenses`, `/customers`, `/sales-orders`, `/inventory-stocks`, `/dashboard-kpis` (CRUD)
- See [apps/backend/api-test-routes.csv](apps/backend/api-test-routes.csv) for every route with sample request bodies and expected status codes. Import it into your CSV testing setup or Postman.

Other useful backend scripts (run from `apps/backend`, or via `pnpm --filter backend <script>` from the root):

- `pnpm prisma:studio` - opens Prisma Studio, a GUI for browsing/editing the database
- `pnpm prisma:migrate` - creates and applies a tracked migration (`prisma migrate dev`)
- `pnpm db:setup` - syncs the Prisma schema to MySQL and seeds the liquor import demo data
- `pnpm db:deploy` - applies checked-in Prisma migrations
- `pnpm db:seed` - loads the liquor import demo seed data
- `pnpm build` - type-checks and compiles the backend to `dist/`
