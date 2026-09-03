# Codebase Concerns

**Analysis Date:** 2026-09-03

## Security Issues

**Unrestricted CORS Configuration:**
- Issue: CORS is enabled globally without origin restrictions in `apps/backend/src/index.ts` (line 12)
- Files: `apps/backend/src/index.ts`
- Impact: Any domain can make requests to the API, enabling CSRF attacks and unauthorized access
- Fix approach: Configure CORS with specific allowed origins: `app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') }))`

**Missing Authentication & Authorization:**
- Issue: All endpoints are publicly accessible with no auth middleware or checks
- Files: `apps/backend/src/routes/index.ts`, all controller files in `apps/backend/src/controllers/`
- Impact: Any user can read, create, update, or delete any data without restrictions. Critical for a business system handling inventory, sales orders, and customer data
- Fix approach: Implement JWT-based authentication middleware and role-based access control (RBAC) on all routes. Protect sensitive endpoints like deletions

**No Input Validation:**
- Issue: Request payloads are not validated with a schema library. Raw conversions like `Number(req.body.value)` occur without validation
- Files: All controller files (e.g., `apps/backend/src/controllers/product.controller.ts` lines 33-34, `apps/backend/src/controllers/importOrder.controller.ts` lines 14-17)
- Impact: Invalid data can be sent to database, causing NaN values, type mismatches, or application crashes. Example: `Number('invalid')` returns `NaN`
- Fix approach: Add Zod or Joi schema validation. Example: `const schema = z.object({ productCode: z.string().min(1) })` before database operations

**Unsafe Date Parsing:**
- Issue: `new Date(String(value))` can throw or create Invalid Date objects without error handling
- Files: `apps/backend/src/controllers/importOrder.controller.ts` lines 43-44, 62
- Impact: Invalid date strings crash the application without being caught by errorHandler if they throw synchronously
- Fix approach: Use safe date parsing with fallbacks or validation: `const date = z.coerce.date().safeParse(value)`

---

## Missing Critical Infrastructure

**No Testing Framework:**
- Issue: Zero tests in codebase. No testing frameworks (Jest, Vitest) installed in `apps/backend/package.json` or `apps/frontend/package.json`
- Files: Entire codebase (no `*.test.ts` or `*.spec.ts` files found)
- Impact: Changes to core business logic (stock transactions, order processing, license management) have no safety net. Refactoring is risky. Data inconsistencies go unnoticed
- Priority: HIGH - Add Jest/Vitest and write tests for critical paths:
  - Stock transaction calculations and product stock updates
  - Sales order creation with license validation
  - Import order processing workflow
  - Financial calculations (discounts, net values)

**No Logging Framework:**
- Issue: Only `console.log()` and `console.error()` used for logging. No structured logging
- Files: `apps/backend/src/middleware/errorHandler.ts` line 30
- Impact: In production, logs are unstructured, difficult to search/analyze, and lack context (request ID, user, timing). Error diagnosis is time-consuming
- Fix approach: Add Winston or Pino logger with structured JSON output, request correlation IDs, and environment-specific log levels

**No Rate Limiting:**
- Issue: No rate limiting middleware on API endpoints
- Files: `apps/backend/src/index.ts`
- Impact: API is vulnerable to brute-force attacks, DDoS, and resource exhaustion
- Fix approach: Add express-rate-limit middleware with per-IP or per-user limits

---

## Data Consistency Concerns

**Manual Stock Updates Not Enforced:**
- Issue: `StockTransaction` records are created, but product `stockQty` is not automatically updated. Manual workflow required
- Files: `apps/backend/src/models/product.model.ts`, `apps/backend/src/models/stockTransaction.model.ts`
- Impact: Stock quantities can become out-of-sync with transactions. Inventory accuracy cannot be trusted. Reports show wrong numbers
- Safe modification: Add a database trigger or application-level transaction that updates `products.stock_qty` when `StockTransaction` is inserted
- Test coverage: Critical gap - no tests verify stock consistency

**Numeric Precision Loss in Decimals:**
- Issue: Prisma Decimal fields are JSON-serialized to numbers, losing precision for financial calculations
- Files: `apps/backend/src/models/product.model.ts`, all financial models
- Impact: Currency calculations (prices, totals, discounts) can have rounding errors. Financial reports are inaccurate
- Fix approach: Return Decimal values as strings in API responses, parse as Decimal.js on frontend, perform calculations there

**Missing Cascade Deletes & Orphaned Records:**
- Issue: Not all relationships have appropriate delete actions. Some use `Restrict` (blocks deletion if children exist) while others cascade
- Files: `apps/backend/prisma/schema.prisma` - Mixed delete behaviors (lines 113 onDelete: Cascade vs 203 onDelete: Restrict)
- Impact: Inconsistent data deletion behavior. Users may not understand why they can't delete a supplier (blocked by products) but can delete an import order (cascades to items)
- Safe modification: Audit all relationships and choose consistent strategy: prefer Soft Deletes for business data (add `deletedAt` timestamp)

---

## Frontend State Management Gaps

**Silent Error Handling in Resource Hook:**
- Issue: `useResource` hook errors in create/update/remove don't propagate or show user feedback
- Files: `apps/frontend/src/hooks/useResource.ts` lines 38-77
- Impact: When create/update/remove fails, state is still modified optimistically. If API rejects the data, frontend state is out-of-sync with backend. User doesn't see error message
- Fix approach: Wrap create/update/remove in try-catch, reject promise on API error, add error toast in caller components

**No Error Boundary for Component Crashes:**
- Issue: No Error Boundary component to catch React render errors
- Files: `apps/frontend/src/App.tsx`
- Impact: Single component crash breaks entire application. Users see blank page with no error message
- Fix approach: Add React Error Boundary wrapper in `App.tsx`

---

## Code Quality & Maintainability

**Large Controllers with Mixed Concerns:**
- Issue: Controllers mix validation parsing, type coercion, and Prisma calls
- Files: `apps/backend/src/controllers/product.controller.ts` (99 lines), `apps/backend/src/controllers/customerLicense.controller.ts` (85 lines)
- Impact: Hard to test, validate, or reuse validation logic. Changes to validation require editing controller
- Safe modification: Extract validation into separate schema validators (with Zod). Extract parsing into middleware. Controllers become thin routers
- Test coverage: Validation logic is untested

**Type Safety Gaps in Request Bodies:**
- Issue: Request bodies are typed as `Record<string, unknown>` then cast without validation
- Files: `apps/backend/src/controllers/salesOrder.controller.ts` line 10: `raw as Record<string, unknown>`
- Impact: TypeScript provides false sense of safety. Runtime type errors possible
- Fix approach: Use Zod to infer strict types: `const parsed = schema.parse(req.body); // type is now precise`

**Frontend Form State Not Typed:**
- Issue: Form state in pages uses `FormState` interfaces, but form fields are untyped string unions
- Files: `apps/frontend/src/pages/ProductsPage.tsx` lines 21-37, 57
- Impact: Easy to mistype field names, add/remove fields inconsistently, or miss fields during refactor
- Fix approach: Use React Hook Form + Zod for end-to-end type safety

---

## Known Fragile Areas

**License Expiry Validation Logic:**
- Files: `apps/backend/src/models/customerLicense.model.ts`
- Why fragile: `daysRemaining` is stored as a column but also calculated in seed. If logic changes, historical data is wrong. No automated recalculation
- Safe modification: Remove `daysRemaining` as stored column. Calculate on read: `Math.max(0, Math.floor((expiryDate - today) / 86400000))`
- Test coverage: No tests for license expiry edge cases (expired, nearly expired, just renewed)

**Import Order Status Workflow:**
- Files: `apps/backend/src/controllers/importOrder.controller.ts`, seed data shows statuses: "PENDING_APPROVAL", "STAGING", "RECEIVED"
- Why fragile: No status machine to enforce valid transitions. Can jump from STAGING to PENDING_APPROVAL backwards. Can never reach some states
- Safe modification: Implement a status state machine (e.g., with TypeScript discriminated unions) to only allow valid transitions
- Test coverage: No tests for illegal status transitions

**Stock Lot Batch Tracking:**
- Files: `apps/backend/prisma/schema.prisma` lines 228-240 (InventoryStock), `apps/backend/src/models/inventoryStock.model.ts`
- Why fragile: `lotBatch` is just a string. No validation that lot exists, expiry dates tracked, or lot quantity matches sales
- Safe modification: Add lot expiry tracking, validate lot availability before allocating to sales orders
- Test coverage: Critical gap - no tests for lot allocation logic

---

## Performance & Scaling Concerns

**N+1 Queries in List Endpoints:**
- Issue: `findAll()` uses `include: { category: true, supplier: true }` which joins all related records
- Files: `apps/backend/src/models/product.model.ts` lines 4-8, similar in other models
- Impact: With 1000s of products, list endpoint loads all categories and suppliers even if not needed. Slow queries, high memory usage
- Improvement path: Make includes optional based on query param: `include: query.full ? { category: true, supplier: true } : undefined`

**No Pagination:**
- Issue: `findAll()` returns all records with no limit
- Files: All `*Model.findAll()` methods
- Impact: As data grows, list endpoints become slow. Frontend loads thousands of records even if displaying 10 per page
- Improvement path: Add limit/offset parameters to `findAll()`, implement cursor-based pagination on frontend

**Unindexed Search:**
- Issue: Frontend filters search in-memory: `r.productName.toLowerCase().includes(q)`
- Files: `apps/frontend/src/pages/ProductsPage.tsx` lines 71-79
- Impact: With 10k+ products, searching becomes slow (O(n) filter in JavaScript)
- Improvement path: Move search to backend with full-text search (MySQL FULLTEXT INDEX on productName/productCode)

---

## Missing Business Logic Safeguards

**Customer Credit Limit Not Enforced:**
- Issue: `Customer.availableCredit` and `creditStatus` are stored but not validated during order creation
- Files: `apps/backend/src/models/customer.model.ts`, `apps/backend/src/controllers/salesOrder.controller.ts`
- Impact: Can create orders beyond customer credit limit without warnings
- Fix approach: Check available credit before allowing order creation: `if (order.netValue > customer.availableCredit) throw new HttpError(400, "Credit limit exceeded")`

**Minimum Stock Alerts Not Triggered:**
- Issue: `Product.minStock` is stored but never checked or alerted
- Files: `apps/backend/prisma/schema.prisma` line 44
- Impact: Can manually look at dashboard but no system-wide minimum stock alerts. Orders might be created for items below minimum
- Fix approach: Add a dashboard endpoint that flags products where `stockQty < minStock`, add email/webhook notifications

**No Audit Trail:**
- Issue: No creation/update user tracking or audit logs for data changes
- Files: All models
- Impact: Cannot trace who created an order, when it was modified, or why. Compliance/accountability issues
- Fix approach: Add `createdBy`, `createdAt`, `updatedBy`, `updatedAt`, and optionally `auditLog` table (already partially in schema: see `CustomerLicense` lines 154-159)

---

## Dependency & Infrastructure Risks

**Hardcoded Host in Backend Scripts:**
- Issue: Backend `package.json` has hardcoded IP in host script: `"host": "tsx watch src/index.ts --host 26.194.75.210"`
- Files: `apps/backend/package.json` line 9
- Impact: Script only works on that specific machine. Breaks on other networks. Commits a personal/environment-specific value
- Fix approach: Use environment variable: `--host ${HOST:-0.0.0.0}` with fallback

**Frontend Base URL Configuration Unclear:**
- Issue: `VITE_API_BASE_URL` env var fallback is `/api` but host script uses full URL context `/useradmin/`
- Files: `apps/frontend/src/api/client.ts` line 3, `apps/frontend/package.json` line 8
- Impact: Frontend might call wrong API endpoints depending on build environment
- Fix approach: Clarify in docs: what values should VITE_API_BASE_URL be for dev/prod? Add env template file

**No Environment Validation:**
- Issue: No startup check that required env vars (DATABASE_URL, etc.) are set
- Files: `apps/backend/src/index.ts`
- Impact: Backend starts but fails mysteriously when trying to connect to database. Long startup debugging
- Fix approach: Add `.env.example` file and startup validation: `if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL required")`

---

## Test Coverage Gaps

**Critical Untested Areas:**
- Stock transaction workflow: No tests verify product stock updates when transactions occur
- Sales order license validation: No tests check that orders can't be created with expired licenses
- Import order status transitions: No tests prevent invalid status workflows
- Financial calculations: No tests for discount/pricing calculations, rounding
- Customer license renewal logic: No tests for renewal from previous license (self-referential relationship in schema line 161-163)

**Type System Limitations:**
- Decimal fields lose precision in JSON serialization - no tests catch rounding errors
- Date parsing doesn't validate format - no tests for invalid dates
- Numeric conversions can produce NaN - no tests catch this

---

*Concerns audit: 2026-09-03*
