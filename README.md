# Storage Demo

A pnpm monorepo with two apps:

- **[apps/frontend](apps/frontend)** — React + TypeScript + Vite
- **[apps/backend](apps/backend)** — Express + TypeScript, MVC structure, Prisma ORM (MySQL)

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
   DATABASE_URL="mysql://user:password@host:3306/database_name"
   PORT=4000
   ```

   `.env` is gitignored — never commit real credentials. `.env.example` is the tracked placeholder template.

3. Push the Prisma schema to your database:

   ```
   pnpm --filter backend prisma:generate
   pnpm --filter backend prisma:push
   ```

   (`db push` diffs `apps/backend/prisma/schema.prisma` against the live database and applies the difference — no migration history or shadow database required, which matters if the database is shared with other projects.)

4. (Optional) Seed sample data — categories, suppliers, products, and stock transactions:

   ```
   pnpm --filter backend prisma:seed
   ```

   The seed script uses upserts keyed on unique codes, so it's safe to re-run.

## Running the apps

From the repo root:

| Command          | Runs                                   |
| ---------------- | --------------------------------------- |
| `pnpm dev:be`     | Backend only, at `http://localhost:4000` |
| `pnpm dev:fe`     | Frontend only, at `http://localhost:5173` (Vite default) |
| `pnpm dev`        | Both apps in parallel                   |

## Backend reference

- Health check: `GET http://localhost:4000/health`
- API base path: `http://localhost:4000/api`
- Routes: `/categories`, `/suppliers`, `/products`, `/stock-transactions` (full CRUD)
- See [apps/backend/api-test-routes.csv](apps/backend/api-test-routes.csv) for every route with sample request bodies and expected status codes — import it into your CSV testing setup or Postman.

Other useful backend scripts (run from `apps/backend`, or via `pnpm --filter backend <script>` from the root):

- `pnpm prisma:studio` — opens Prisma Studio, a GUI for browsing/editing the database
- `pnpm prisma:migrate` — creates and applies a tracked migration (`prisma migrate dev`); prefer `db push` when working against a shared remote database
- `pnpm build` — type-checks and compiles the backend to `dist/`
