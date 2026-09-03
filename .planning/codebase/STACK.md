# Technology Stack

**Analysis Date:** 2026-09-03

## Languages

**Primary:**
- TypeScript ~6.0.2 - Used across frontend and backend with `type: "module"` for ES modules
- JavaScript - Utility scripts

**Secondary:**
- SQL - Prisma migrations and seed scripts

## Runtime

**Environment:**
- Node.js 20+ (as specified in README)

**Package Manager:**
- pnpm 9+ (monorepo workspace manager)
- Lockfile: `pnpm-lock.yaml` (present)

## Frameworks

**Frontend (apps/frontend):**
- React 19.2.8 - UI framework with functional components
- Vite 8.2.2 - Build tool and dev server
- React Router DOM 7.18.3 - Client-side routing and navigation
- Tailwind CSS 4.3.3 - Utility-first CSS framework via Vite plugin (`@tailwindcss/vite` 4.3.3)
- Lucide React 1.39.0 - Icon library

**Backend (apps/backend):**
- Express 4.21.2 - Web server and HTTP routing
- Prisma 6.4.1 - ORM and database toolkit
- tsx 4.23.13 - TypeScript execution runtime for development

**Internationalization:**
- i18next 26.4.1 - Translation framework
- react-i18next 17.0.13 - React bindings for i18next
- i18next-browser-languagedetector 8.2.1 - Automatic language detection

## Key Dependencies

**Critical:**
- `@prisma/client` 6.4.1 - Prisma database client for backend data access
- `express` 4.21.2 - Core HTTP server framework
- `react` 19.2.8 - Frontend UI framework
- `cors` 2.8.5 - Cross-origin resource sharing middleware for Express

**Development/Build:**
- `typescript` ~6.0.2 - TypeScript compiler
- `tsx` 4.23.13 - TypeScript executor for running TS files directly
- `prisma` 6.4.1 - Prisma CLI and schema management
- `vite` 8.2.2 - Frontend build tool and dev server
- `@vitejs/plugin-react` 6.1.0 - React plugin for Vite
- `eslint` 10.9.0 - Linting tool
- `typescript-eslint` 8.69.0 - TypeScript support for ESLint

**Environment Management:**
- `dotenv` 17.2.3 - Environment variable loading

## Configuration

**Environment:**
- Configured via `.env` files (gitignored)
- Backend: `apps/backend/.env` (copy from `.env.example`)
- Frontend: `apps/frontend/.env.development` for development build
- Critical env var: `DATABASE_URL` (MySQL connection string)
- Secondary env var: `PORT` (default 4000 for backend)

**Build Configuration:**
- Frontend Vite config: `apps/frontend/vite.config.ts`
- Backend TypeScript config: `apps/backend/tsconfig.json`
- ESLint config: `apps/frontend/eslint.config.js`
- Tailwind CSS: Configured via Vite plugin in `apps/frontend/vite.config.ts`

**Monorepo Configuration:**
- Workspace definition: `pnpm-workspace.yaml`
- Root package.json: Aggregates dev scripts (`dev`, `dev:fe`, `dev:be`, `host`)

## Platform Requirements

**Development:**
- Node.js 20 or higher
- pnpm 9 or higher
- MySQL 5.7+ (or MariaDB equivalent) for database backend
- Modern web browser (React 19 targets ES2020+)

**Production:**
- Node.js 20+ runtime
- MySQL database (accessed via `DATABASE_URL`)
- HTTP server to serve frontend static assets (Vite produces `dist/` folder)
- Express backend runs on configurable `PORT` and `HOST`

---

*Stack analysis: 2026-09-03*
