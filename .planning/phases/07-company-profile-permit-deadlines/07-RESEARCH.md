# Phase 7: Company Profile & Permit Deadlines - Research

**Researched:** 2026-09-11
**Domain:** Prisma/Express/React CRUD extension — new `Company` singleton model, `License` linking (FKs + computed status), threshold-bucketed dashboard grouping, order-creation blocking gate
**Confidence:** HIGH (codebase-verified for all structural claims; MEDIUM/LOW flagged separately for anything not directly observed)

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COMPANY-01 | System stores one Company profile (legal name, Tax ID, address) reused across permits and generated documents | See Code Examples (Company model), Pitfall 4 (singleton enforcement) |
| PERMIT-01 | A License record links to the Company and, optionally, to a specific Product; existing unlinked licenses remain valid | See Code Examples (nullable companyId/productId FKs), Runtime State Inventory |
| PERMIT-02 | Permit status auto-derives from days-to-expiry using 120/90/60/30/0-day tiers | See Pattern 1 (computePermitStatus), Pitfall 1 |
| PERMIT-03 | Dashboard surfaces permits grouped by threshold bucket instead of a flat list | See Architectural Responsibility Map, System Architecture Diagram (client-side groupBy) |
| PERMIT-04 | An expired permit is visibly flagged and blocks new import/sales orders for its linked product | See Pattern 2 (transactional pre-check), Pitfall 2/3, Security Domain |
</phase_requirements>

## Summary

Phase 7 is a same-shape extension of patterns already fully implemented three times in this codebase (Product/Supplier/Category style master data, `CustomerLicense` status-gated linkage, `SalesOrderModel`/`ImportOrderModel` transactional create/update). No new library, framework, or architectural pattern is required — everything needed (Prisma relations, computed-field-on-read, a blocking pre-check inside an existing `prisma.$transaction`) already has a working precedent in this repo that Phase 7 should copy rather than invent.

The single biggest technical fact this research confirms: `License.daysRemaining` and `License.status` are **currently hand-set** by the frontend/caller on every create/update (`apps/backend/src/controllers/license.controller.ts` accepts `daysRemaining`/`status` directly in the request body; `apps/backend/src/models/license.model.ts` just persists whatever is passed). There is no cron, no scheduled job, and no on-read recomputation anywhere in the backend. PERMIT-02 ("status auto-derives from days-to-expiry, not hand-set") requires removing these two fields from client input entirely and computing them server-side on every read (and/or via a stored-but-recomputed pattern) — this is a behavior change, not an additive feature.

The second key fact: RBAC/Audit (Phase 2 of ROADMAP.md) has **not** been implemented in the codebase despite being ordered before Phase 7 in the roadmap and STATE.md showing it as "not started." Only `requireAuth` (Phase 1) exists on all routes; there is no `requirePermission` middleware, no `AuditLogModel`, and no role/permission tables in `schema.prisma`. Phase 7 plans must not assume RBAC primitives exist — new License/Company endpoints should follow the exact same `requireAuth`-only pattern as every other existing route (see `license.routes.ts`), not a hypothetical permission-gated pattern.

**Primary recommendation:** Add a single `Company` model (no FK from anywhere except optionally `License`), add nullable `companyId`/`productId` FKs to `License`, delete the hand-set `daysRemaining`/`status` DB columns (or keep `status` as a derived-only computed field not accepted from input) and compute status via a shared pure function `computePermitStatus(expiryDate)` used both on read (API response shaping) and re-used by the dashboard grouping logic and the order-blocking gate. Reuse the `validateAndSnapshotLicense`-style transactional pre-check pattern from `salesOrder.model.ts` to block import/sales order creation when a product-linked License is expired.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Company profile CRUD | API/Backend (Express + Prisma) | Browser (settings-style form) | Simple reference-data CRUD identical to Supplier/Customer |
| License → Company/Product linking | API/Backend | Database (FK constraints) | Referential integrity must be enforced at the DB/Prisma layer, not just UI |
| Permit status derivation (120/90/60/30/expired) | API/Backend (computed on read) | Browser (badge coloring only) | Must be computed server-side so API consumers (blocking gate, dashboard) never trust a stale client-set value; frontend only maps the already-computed status to a color |
| Dashboard threshold-bucket grouping | Browser (client-side grouping of already-fetched licenses) | API/Backend (could optionally pre-group, not required) | Existing `DashboardPage.tsx` already does client-side `useMemo` filtering of fetched lists (see `expiringLicenses`); grouping into 5 buckets is the same pattern scaled up — no new endpoint needed |
| Expired-permit order blocking | API/Backend (inside `ImportOrderModel.create`/`SalesOrderModel.create` transaction) | Browser (disable button, non-authoritative) | Core value proposition of this milestone ("prevent invalid actions at the backend, not just hide buttons") — mirrors `validateAndSnapshotLicense` in `salesOrder.model.ts` which already gates on `CustomerLicense` validity inside the same `$transaction` |

## Standard Stack

### Core
No new packages required. Confirmed current versions from `apps/backend/package.json`:

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@prisma/client` / `prisma` | ^6.4.1 [VERIFIED: apps/backend/package.json] | ORM, schema migrations | Already the sole persistence layer; all models follow this pattern |
| `express` | ^4.21.2 [VERIFIED: apps/backend/package.json] | HTTP routing | Existing controller/route/model 3-layer pattern |
| `zod` | ^4.5.4 [VERIFIED: apps/backend/package.json] | Schema validation | Listed as a dependency but **not currently used** in any controller except `auth.controller.ts` [VERIFIED via grep] — existing License/Order controllers do manual `if (!field) throw HttpError(400, ...)` checks instead. Phase 7 should follow the manual-validation pattern already used by 90% of controllers unless the planner deliberately wants to introduce zod validation as new convention (out of scope note below). |

### Supporting
None — no date/scheduling library needed. Status derivation is a pure function on `Date` arithmetic (`Math.floor((expiryDate - today) / 86400000)`), same technique already used client-side in `LicensesPage.tsx`'s `handleExpiryChange`.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Compute status on every read (no stored `status` column, or a stored-but-always-recomputed column) | A cron/scheduled job that periodically writes `status` to the DB | Adds a new operational component (job scheduler) for zero benefit — computing on read is O(1) per row and the dashboard already re-fetches on load; a cron would only be needed for push-notification/email alerting, which is not in PERMIT-01..04 scope. `[ASSUMED]` no notification-email requirement exists — REQUIREMENTS.md text says "notify on a tiered schedule" in the phase goal one-liner but the actual PERMIT-01..04 acceptance criteria only require *dashboard grouping*, not outbound notifications (email/Slack/etc.). Flagged in Open Questions. |
| Keep `daysRemaining` as a stored column | Drop `daysRemaining` from schema entirely, compute on the fly from `expiryDate` | Storing a derived value that must be kept in sync is exactly the STOCK-06-style anti-pattern this milestone's ENFORCE/STOCK phases were built to eliminate (auditable computed values, not manually maintained ones — see DOCS-04's "KPIs computed from live data, not manually maintained rows" for the same philosophy applied here) |

**Installation:** None — no new packages.

**Version verification:** All versions above read directly from `apps/backend/package.json` (2026-09-11); no `npm view` registry check performed since these are pinned existing project dependencies, not new additions.

## Architecture Patterns

### System Architecture Diagram

```
[Frontend: LicensesPage.tsx / new CompanyPage.tsx]
        │  GET/POST/PUT /api/licenses, /api/companies
        ▼
[Express Router] --requireAuth-->  [Controller: license.controller.ts]
        │                                   │
        │                                   ▼
        │                         [LicenseModel.findAll/findById]
        │                                   │  (Prisma include: company, product)
        │                                   ▼
        │                         [permitStatus.ts: computePermitStatus(expiryDate)]
        │                                   │  (pure fn, tier lookup 120/90/60/30/expired)
        │                                   ▼
        │                         shape response: { ...license, daysRemaining, status }
        ▼
[DashboardPage.tsx]
   GET /api/licenses (all rows, already status-computed)
        │
        ▼
   client-side groupBy(status) → 5 buckets (120/90/60/30/expired) → render

[ImportOrderModel.create / SalesOrderModel.create]
        │  prisma.$transaction(async tx => {
        ▼      if item.productId has a License with productId set and status === EXPIRED:
   [checkProductLicenseNotExpiredTx(tx, productId)]  --throws HttpError(400)-->  transaction aborts, no order row written
        │  (mirrors validateAndSnapshotLicense in salesOrder.model.ts)
        ▼
   order created, stock transaction posted (existing flow unchanged)
```

### Recommended Project Structure
```
apps/backend/prisma/schema.prisma       # add Company model; add companyId/productId to License
apps/backend/src/
├── models/
│   ├── company.model.ts                # new — CRUD, same shape as supplier.model.ts
│   └── license.model.ts                # extend — add companyId/productId to create/update, include relations
├── controllers/
│   ├── company.controller.ts           # new
│   └── license.controller.ts           # extend — stop accepting daysRemaining/status from body
├── routes/
│   ├── company.routes.ts               # new — requireAuth only (no RBAC exists yet)
│   └── license.routes.ts               # extend with companyId/productId fields
├── utils/
│   └── permitStatus.ts                 # new — computePermitStatus(expiryDate): { daysRemaining, status, bucket }
└── models/importOrder.model.ts, salesOrder.model.ts  # extend create() to call the new blocking check inside $transaction

apps/frontend/src/
├── api/types.ts                        # add Company interface; extend License with companyId/productId/company?/product?
├── api/resources.ts                    # add companyApi = createResourceApi<Company>("/companies")
├── pages/
│   ├── CompanyPage.tsx                 # new — likely single-record "settings" form, not a DataTable list
│   ├── LicensesPage.tsx                # extend — add Company/Product select fields, remove manual daysRemaining/status inputs
│   └── DashboardPage.tsx               # extend — replace flat expiringLicenses filter with 5-bucket grouping
└── lib/
    └── status.ts                       # extend TONE_BY_CODE with new permit tier codes if tier names differ from NORMAL/EXPIRING_SOON/EXPIRED
```

### Pattern 1: Computed-on-read status (no stored mutable status column trusted from input)
**What:** A pure function takes `expiryDate`, returns `{ daysRemaining, status, bucket }`. Called in the model layer (or controller response-shaping step) on every `findAll`/`findById`, never trusted from `req.body`.
**When to use:** Any time a "status" is fully determined by another stored fact (here, `expiryDate` vs. today) — same principle DOCS-04 established for dashboard KPIs.
**Example:**
```typescript
// New file: apps/backend/src/utils/permitStatus.ts
// Pattern source: existing client-side computeStatus() in LicensesPage.tsx line 45-49,
// promoted to the backend and expanded from 1-tier (30-day) to 4-tier (120/90/60/30).
export type PermitBucket = "PREPARATION" | "NOTIFY" | "WARNING" | "IMPORTANT_WARNING" | "EXPIRED" | "NORMAL";

export function computePermitStatus(expiryDate: Date, today = new Date()) {
  const d = new Date(today); d.setHours(0, 0, 0, 0);
  const daysRemaining = Math.round((expiryDate.getTime() - d.getTime()) / 86400000);
  let bucket: PermitBucket;
  if (daysRemaining < 0) bucket = "EXPIRED";
  else if (daysRemaining <= 30) bucket = "IMPORTANT_WARNING";
  else if (daysRemaining <= 60) bucket = "WARNING";
  else if (daysRemaining <= 90) bucket = "NOTIFY";
  else if (daysRemaining <= 120) bucket = "PREPARATION";
  else bucket = "NORMAL";
  return { daysRemaining, status: bucket };
}
```
`[VERIFIED: apps/frontend/src/pages/LicensesPage.tsx lines 45-49]` for the existing single-tier precedent this generalizes.

### Pattern 2: Transactional pre-check that blocks order creation (existing precedent)
**What:** `salesOrder.model.ts`'s `validateAndSnapshotLicense` runs inside the same `prisma.$transaction` as order creation, throws `HttpError(400, ...)` before any row is written if the license is invalid.
**When to use:** PERMIT-04's "block new import/sales order for that product until resolved" — same shape, different trigger condition (product-linked License status === EXPIRED, vs. customer-linked license validity).
**Example:**
```typescript
// Source: apps/backend/src/models/salesOrder.model.ts lines 60-71 (existing code, verbatim)
const validateAndSnapshotLicense = async (tx: Prisma.TransactionClient, customerId: number, customerLicenseId: number) => {
  const license = await tx.customerLicense.findUnique({ where: { customerLicenseId } });
  if (!license) throw new HttpError(400, "Selected customer license not found");
  if (license.customerId !== customerId) throw new HttpError(400, "Selected license does not belong to this customer");
  if (!isLicenseValid(license)) throw new HttpError(400, "Selected license is not active or has expired");
  return { /* snapshot fields */ };
};
```
Phase 7's new check follows the same shape but keys off `productId` instead of `customerId`/`customerLicenseId`, and must be called from **both** `ImportOrderModel.create`/`update` and `SalesOrderModel.create`/`update`, for **every line item's `productId`**, inside the existing `prisma.$transaction`.

### Anti-Patterns to Avoid
- **Trusting `daysRemaining`/`status` from `req.body` (current bug in `license.controller.ts`):** `createLicense`/`updateLicense` currently read `daysRemaining` and `status` straight from the request and persist them unchanged — this is exactly what PERMIT-02 requires eliminating. Do not carry this pattern into the new endpoints; strip these two fields from accepted input entirely (or ignore them if present) and derive both server-side.
- **Blocking only in the frontend:** `LicensesPage.tsx`/`DashboardPage.tsx` currently compute expiry-based UI coloring client-side (`r.daysRemaining < 0 ? ... : ...`), but this is *display only*. PERMIT-04 explicitly requires the block to happen at the backend transaction level — mirrors the project's Core Value statement in REQUIREMENTS.md line 4 ("prevent invalid business actions... at the backend — not just hide buttons in the UI").
- **Assuming RBAC/permission middleware exists:** No `requirePermission` middleware or audit-log wrapping exists anywhere in `apps/backend/src` today (confirmed via grep — zero matches for `requirePermission`/`AuditLogModel`). New Company/License endpoints should use `requireAuth` only, matching every other current route, not a hypothetical permission check.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Days-until-expiry math | Custom date-diff library or manual leap-year handling | Plain `Date` arithmetic with `.setHours(0,0,0,0)` normalization (already the exact technique used in `LicensesPage.tsx` and `customerLicense.model.ts`'s `isLicenseValid`) | JS `Date` millisecond subtraction is sufficient and already proven correct in this codebase for the same problem twice |
| Tiered notification thresholds | A generic configurable-threshold rules engine | A single pure function with 5 hardcoded `if` branches (120/90/60/30/0) per Pattern 1 above | REQUIREMENTS.md PERMIT-02 hardcodes the exact tier boundaries (120/90/60/30d); there is no stated requirement for admin-configurable thresholds, so a rules engine is unjustified complexity |

**Key insight:** Every piece of Phase 7 has a working analog already in this codebase (CustomerLicense's status gate, DashboardPage's client-side alert bucketing, SalesOrderModel's transactional pre-check). The research task here was locating and confirming those analogs, not discovering new external technology.

## Runtime State Inventory

Not applicable — Phase 7 is additive schema (new `Company` model, new nullable FKs on `License`) plus a behavior change to existing `License.daysRemaining`/`status` handling, not a rename/refactor/migration of existing identifiers. No existing stored data needs renaming; existing `License` rows with `companyId`/`productId` left `NULL` continue to work per the Success Criteria #2 requirement ("existing licenses without a link keep working unchanged").

One migration-shaped item to flag for the planner: existing seeded `License` rows (`apps/backend/prisma/seed.ts` lines 257-264, 631-635) currently insert explicit `daysRemaining`/`status` values (e.g. `-235`, `"EXPIRED"`). If these columns are dropped or become read-only-derived, `seed.ts` must be updated to stop passing them — this is a **code edit**, not a data migration, since no separate persisted store needs backfilling (the DB table itself is dropped/recreated via `prisma db push` in this project's non-migration-tracked workflow — see `db:setup` script using `prisma db push`, not `prisma migrate deploy`, confirming this project doesn't run production migrations against live data yet).

## Common Pitfalls

### Pitfall 1: Silently keeping `daysRemaining`/`status` writable alongside computed values
**What goes wrong:** If the planner adds `computePermitStatus` but forgets to remove `daysRemaining`/`status` from `createLicense`/`updateLicense`'s accepted body fields, a caller can still write a stale/wrong status that later reads either get overridden by (if computed-on-read wins) or silently trusted (if not) — an inconsistent half-migration.
**Why it happens:** The existing controller code (`license.controller.ts` lines 18-35) already destructures and requires these two fields; it's easy to extend rather than replace.
**How to avoid:** Explicitly remove `daysRemaining` and `status` from `LicenseModel.create`/`update`'s input type and from the controller's request-body destructuring; compute both exclusively via `computePermitStatus` in the read path (`findAll`/`findById`) as a response-shaping step, never accept from input.
**Warning signs:** Any test or manual POST that supplies `status: "NORMAL"` for an expiry date that's actually already past and the API returns 201 without complaint.

### Pitfall 2: Blocking check only covers `SalesOrderModel`, not `ImportOrderModel` (or vice versa)
**What goes wrong:** PERMIT-04 explicitly requires blocking "new import **or** sales order" — it's easy to add the check to `salesOrder.model.ts` (which already has a similar license-check precedent) and forget `importOrder.model.ts` (which currently has *no* license-checking precedent at all).
**Why it happens:** `salesOrder.model.ts` already imports `isLicenseValid` and has a natural home for one more check; `importOrder.model.ts` has zero license-awareness today, making it the "new" work that's easier to skip.
**How to avoid:** Explicitly list both `ImportOrderModel.create`/`update` and `SalesOrderModel.create`/`update` as separate plan tasks; write a test for each.
**Warning signs:** A sales order correctly rejects an expired-permit product but an import order for the same product succeeds.

### Pitfall 3: Update-path items array (edit an existing order) bypasses the same check
**What goes wrong:** Both `ImportOrderModel.update` and `SalesOrderModel.update` have a separate code path when `items` is provided vs. when it isn't (see `salesOrder.model.ts` lines 129-141 vs. 144-172). If the blocking check is only added to `create`, editing an existing order to add a line item for an expired-permit product would bypass the gate.
**Why it happens:** `create` and `update` are structurally similar but not shared code — a fix applied to one doesn't propagate to the other without deliberate duplication or extraction.
**How to avoid:** Extract the check into a shared helper (e.g. `assertProductsNotBlockedTx(tx, items)`) called from all four mutation entry points (import create/update, sales create/update) wherever `items` rows are about to be created.
**Warning signs:** Blocking works on order creation in manual testing but not when editing an existing DRAFT order's line items.

### Pitfall 4: Company as a list resource instead of a true singleton
**What goes wrong:** If `CompanyModel`/`companyApi` is built as a generic `createResourceApi<Company>("/companies")` list CRUD (copy-pasting the Supplier pattern verbatim), the UI could accidentally allow creating multiple Company rows, contradicting "one Company profile" (COMPANY-01) and "single site" scope note.
**Why it happens:** Every other master-data resource in this codebase (Supplier, Category, Customer) is a genuine list; Company is architecturally different (a singleton) but superficially looks the same to copy-paste from.
**How to avoid:** Either enforce singleton at the DB level (a fixed `companyId = 1` upsert-only pattern, no delete/create-many) or add an application-level guard that a second Company row cannot be created. Frontend should render `CompanyPage.tsx` as a single edit form (GET the one record, PUT to update), not a `DataTable` list with an add/delete affordance.
**Warning signs:** A "Company" list page with a "+ Add Company" button and multiple rows in the seed data.

## Code Examples

### Adding companyId/productId to License (schema change)
```prisma
// Source: extends existing apps/backend/prisma/schema.prisma License model (lines 123-135)
model Company {
  companyId Int    @id @default(autoincrement()) @map("company_id")
  legalName String @map("legal_name")
  taxId     String @map("tax_id")
  address   String

  licenses License[]

  @@map("companies")
}

model License {
  licenseId   Int      @id @default(autoincrement()) @map("license_id")
  licenseNo   String   @unique @map("license_no")
  licenseType String   @map("license_type")
  holderName  String   @map("holder_name")
  category    String
  issueDate   DateTime @map("issue_date") @db.Date
  expiryDate  DateTime @map("expiry_date") @db.Date
  // daysRemaining/status columns removed or repurposed — see Pattern 1

  companyId Int?     @map("company_id")
  productId Int?     @map("product_id")
  company   Company? @relation(fields: [companyId], references: [companyId])
  product   Product? @relation(fields: [productId], references: [productId])

  @@map("licenses")
}
```
Note: existing `Product` model (`schema.prisma` line 36) needs a back-relation `licenses License[]` added for the `product` field above to compile under Prisma's relation requirements — a one-line addition to the existing model, not a new model.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `License.daysRemaining`/`status` hand-set by caller on every create/update | Computed server-side from `expiryDate` on every read via `computePermitStatus` | This phase (Phase 7) | Removes the possibility of a stale/wrong status ever being persisted; consistent with the milestone's DOCS-04 precedent (dashboard KPIs computed from live data, not manually maintained rows) |
| Single flat "expiring soon" (≤30 days) license alert on the dashboard | 5-tier bucketed grouping (120/90/60/30/expired) | This phase | Matches PERMIT-03; dashboard already has the `useMemo`-based client grouping infrastructure to extend |
| `License` table implicitly represents only the company's own import licenses (per seed.ts comment line 254) | Explicitly linked to `Company` (always) and optionally `Product` | This phase | PERMIT-01 makes the previously-implicit "this is our company's license" relationship explicit and queryable |

**Deprecated/outdated:** None — no library APIs are being deprecated, this is pure application-level schema/logic evolution.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The phase goal's word "notify" (ROADMAP.md: "notify on a tiered schedule") means dashboard-surfaced grouping only, not outbound notifications (email/Slack/push) | Summary, Alternatives Considered | If the user actually wants outbound notifications, a notification-sending mechanism (and its own library/service research) is entirely missing from this research and would need a follow-up research pass |
| A2 | Company should be enforced as an application-level singleton (one row) rather than allowing multiple companies with a "primary" flag | Pitfall 4 | If multi-company is actually intended even within "single site" scope, the singleton constraint would need loosening — but the scope note explicitly says "only a single `Company` profile is added," supporting singleton |
| A3 | `daysRemaining` should be fully computed and never stored (vs. stored-but-recomputed-on-write) | Pattern 1, Alternatives Considered | If the planner prefers keeping a stored `daysRemaining` column for query/sort performance (e.g. `ORDER BY daysRemaining` in SQL rather than computing in JS after fetch), the migration shape differs slightly — worth confirming during planning since `LicenseModel.findAll` currently does `orderBy: { expiryDate: "asc" }` which achieves the same sort order without needing a stored days-remaining column, so computed-only remains the simpler choice |
| A4 | PERMIT-04's block applies at order-creation time only (matching the existing `validateAndSnapshotLicense` pattern which runs at create/update, not applied retroactively to already-approved past orders) | Pattern 2, Pitfall 2/3 | Low risk — Success Criteria #5 explicitly says "creating a new import or sales order... is blocked," confirming create-time scope, not retroactive |

## Open Questions

1. **Does "notify on a tiered schedule" require any outbound notification (email, in-app toast on login, etc.) beyond the dashboard grouping?**
   - What we know: PERMIT-01..04's literal acceptance criteria (REQUIREMENTS.md lines 79-82) only mention linking, computed status, dashboard grouping, and order-blocking — no email/notification endpoint or requirement.
   - What's unclear: The phase goal one-liner in ROADMAP.md uses the word "notify" which could imply more than passive dashboard display.
   - Recommendation: Treat as dashboard-only for planning (per Assumption A1); confirm with user during `/gsd-discuss-phase` before locking, since adding a notification channel would be new architectural scope (email service, in-app notification model) not covered by this research.

2. **Should `License.status`/`daysRemaining` be removed as DB columns entirely, or kept as computed-then-persisted-on-write values?**
   - What we know: Fully computed-on-read (Assumption A3) is simpler and avoids sync bugs; existing `findAll` already sorts by `expiryDate` so no query-performance need for a stored `daysRemaining` column is evident at current data scale (seed has ~6 License rows).
   - What's unclear: Whether the planner wants to preserve the column for backward-compat with any external report/export not covered in this research (DOCS-03 CSV/PDF export, Phase 6, may reference `licenses.status`/`days_remaining` columns directly).
   - Recommendation: Check Phase 6's implementation (if completed) for any raw SQL or CSV column mapping that references `licenses.status`/`days_remaining` by name before deciding to drop the columns outright; if none found, drop them.

3. **What exact status codes should the 5 tiers use?**
   - What we know: REQUIREMENTS.md PERMIT-02 names the tiers descriptively ("Preparation for renewal", "Notify", "Warning", "Important warning", "Expired") but doesn't give machine-readable codes; existing `License.status` uses `NORMAL`/`EXPIRING_SOON`/`EXPIRED` (3-tier) and `statusTone` in `apps/frontend/src/lib/status.ts` maps those to colors.
   - What's unclear: Whether to keep `NORMAL`/`EXPIRING_SOON`/`EXPIRED`-style naming (extending to 5 codes) or introduce new codes matching the descriptive tier names verbatim (`PREPARATION`, `NOTIFY`, `WARNING`, `IMPORTANT_WARNING`, `EXPIRED`).
   - Recommendation: Use the descriptive-name-derived codes (as drafted in the Code Examples section) since they map 1:1 to REQUIREMENTS.md's own tier language, and update `apps/frontend/src/lib/status.ts`'s `TONE_BY_CODE` map and `apps/frontend/src/i18n/locales/{en,ja}.ts`'s `license:` status labels accordingly (both currently only have the 3 old codes).

## Environment Availability

Not applicable — Phase 7 has no external tool/service dependencies beyond the already-running MySQL database and Node/npm toolchain already in use by every prior phase. No new CLI, runtime, or service is introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^2.1.8 + Supertest ^7.0.0 [VERIFIED: apps/backend/package.json] |
| Config file | none found — no `vitest.config.ts` located in `apps/backend`; tests run via `"test": "vitest run"` script relying on Vitest defaults |
| Quick run command | `npm test -- tests/license.test.ts` (per-file, once created) |
| Full suite command | `npm test` (from `apps/backend`) |

**Wave 0 gap:** No `vitest.config.ts` was found via search of `apps/backend`; the existing 8 test files (`tests/auth.*.test.ts`, `tests/middleware.auth.test.ts`) run successfully today per Vitest zero-config defaults, so this is likely not blocking, but confirm during Wave 0 that `apps/backend/tests/` is Vitest's default discovery root.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| COMPANY-01 | Company CRUD persists and is reused (e.g. license references it) | integration (supertest) | `npx vitest run tests/company.test.ts` | ❌ Wave 0 |
| PERMIT-01 | License create/update accepts optional `companyId`/`productId`; existing unlinked licenses unaffected | integration | `npx vitest run tests/license.test.ts` | ❌ Wave 0 |
| PERMIT-02 | `status`/`daysRemaining` computed from `expiryDate`, not accepted from request body | unit (pure fn) + integration | `npx vitest run tests/permitStatus.test.ts` | ❌ Wave 0 |
| PERMIT-03 | Dashboard/API groups licenses into 120/90/60/30/expired buckets | unit (grouping logic, backend or frontend depending on final placement) | `npx vitest run tests/permitStatus.test.ts` (if grouping logic lives in `permitStatus.ts`) | ❌ Wave 0 |
| PERMIT-04 | Import/sales order creation blocked when linked product has an EXPIRED License | integration | `npx vitest run tests/importOrder.license-block.test.ts`, `tests/salesOrder.license-block.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <specific new test file>`
- **Per wave merge:** `npm test` (full backend suite, from `apps/backend`)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/backend/tests/company.test.ts` — covers COMPANY-01
- [ ] `apps/backend/tests/license.test.ts` — covers PERMIT-01 (no test file for License CRUD exists today at all — this is also a pre-existing coverage gap, not just a Phase 7 gap)
- [ ] `apps/backend/tests/permitStatus.test.ts` — covers PERMIT-02/PERMIT-03 (unit tests for the new `computePermitStatus` pure function — boundary cases at exactly 120/90/60/30/0 days)
- [ ] `apps/backend/tests/importOrder.license-block.test.ts`, `apps/backend/tests/salesOrder.license-block.test.ts` — covers PERMIT-04 for both order types (per Pitfall 2)
- [ ] No test infra changes needed — Vitest/Supertest already configured and working (per `tests/auth.*.test.ts`)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | Existing `requireAuth` (JWT) on all new routes — no new auth surface |
| V3 Session Management | no | Unchanged from Phase 1 |
| V4 Access Control | partial — `[ASSUMED]` | No RBAC exists yet in this codebase (confirmed via grep); Phase 7 endpoints should be `requireAuth`-only, matching every existing route. If RBAC (Phase 2) lands before Phase 7 executes, new Company/License write endpoints should gate on an appropriate permission (e.g. `license:write`), but this cannot be verified/implemented now since no permission middleware exists to reference. |
| V5 Input Validation | yes | Manual `if (!field) throw HttpError(400,...)` pattern, matching every other controller in this codebase (no zod usage outside `auth.controller.ts`) — validate `companyId`/`productId` exist via Prisma FK constraint (will throw a P2003 foreign-key-violation error on invalid IDs; wrap in try/catch or pre-check with `findUnique` for a clean 400 rather than a raw Prisma error, matching `validateAndSnapshotLicense`'s explicit `if (!license) throw HttpError(400, ...)` pre-check pattern) |
| V6 Cryptography | no | Not applicable to this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client supplies `status`/`daysRemaining` directly, bypassing server-computed truth (current bug being fixed by this phase) | Tampering | Strip these fields from accepted request body entirely; compute server-side only (Pattern 1) |
| Order creation bypasses the expired-permit block by hitting the API directly (not through the UI) | Tampering / Elevation of Privilege | Enforce the block inside the Prisma `$transaction` in the model layer (Pattern 2), not in a controller-level pre-check that a differently-routed request could skip — matches this codebase's Core Value statement (REQUIREMENTS.md line 4) |
| Prisma FK violation (invalid `companyId`/`productId`) leaks a raw stack-trace-shaped 500 error instead of a clean 400 | Information Disclosure | Pre-check referenced IDs exist via `findUnique` before insert, matching the `validateAndSnapshotLicense` precedent, rather than relying on Prisma's raw `P2003` error to bubble to the client |

## Sources

### Primary (HIGH confidence — direct codebase reads this session)
- `apps/backend/prisma/schema.prisma` — full current schema, confirms no existing Company model, no RBAC/audit tables, License's flat structure
- `apps/backend/src/models/license.model.ts`, `apps/backend/src/controllers/license.controller.ts` — confirms `daysRemaining`/`status` are hand-set, never recomputed
- `apps/backend/src/models/salesOrder.model.ts`, `apps/backend/src/models/customerLicense.model.ts` — confirms the exact transactional blocking-check pattern to reuse for PERMIT-04
- `apps/backend/src/models/importOrder.model.ts` — confirms import orders currently have zero license-awareness (Pitfall 2 basis)
- `apps/backend/src/routes/license.routes.ts` and full `routes/` directory listing — confirms no `requirePermission` middleware exists anywhere
- `apps/frontend/src/pages/LicensesPage.tsx`, `apps/frontend/src/pages/DashboardPage.tsx` — confirms current single-tier (30-day) client-side grouping pattern to extend to 5 tiers
- `apps/frontend/src/api/types.ts`, `apps/frontend/src/api/resources.ts` — confirms current `License` interface shape and `createResourceApi` helper pattern
- `apps/frontend/src/lib/status.ts` — confirms `TONE_BY_CODE` badge-color mapping needs new tier codes added
- `apps/backend/prisma/seed.ts` — confirms License seed rows hand-insert `daysRemaining`/`status`; confirms project uses `prisma db push` (not tracked migrations) for schema sync
- `apps/backend/package.json` — confirms exact dependency versions, confirms zod is installed but essentially unused outside auth
- `apps/backend/tests/` directory listing — confirms zero test coverage exists for License, Company, ImportOrder, or SalesOrder today (only auth is tested)
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/config.json` — phase requirements, success criteria, scope note, workflow settings (nyquist_validation enabled)

### Secondary (MEDIUM confidence)
None used — no external web sources were needed for this phase; it is entirely an extension of proven internal patterns.

### Tertiary (LOW confidence)
None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - no new libraries; all versions read directly from `package.json`
- Architecture: HIGH - every pattern cited has a working precedent read directly from the codebase this session
- Pitfalls: HIGH - derived from actual gaps observed in the existing code (e.g. import order's total absence of license-checking, controller's direct trust of `daysRemaining`/`status` input)

**Research date:** 2026-09-11
**Valid until:** No external-dependency expiry risk (internal codebase research); revisit if Phase 2 (RBAC/Audit) or Phase 6 (Documents/Reporting CSV export) land before Phase 7 executes, since both could change assumptions in the Security Domain and Open Question #2 sections respectively.
