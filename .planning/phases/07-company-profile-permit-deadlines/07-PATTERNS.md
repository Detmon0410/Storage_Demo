# Phase 7: Company Profile & Permit Deadlines - Pattern Map

**Mapped:** 2026-09-11
**Files analyzed:** 17
**Analogs found:** 16 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/backend/prisma/schema.prisma` (Company model + License FKs) | model/schema | CRUD | `Supplier`/`License` models (same file) | exact |
| `apps/backend/src/models/company.model.ts` | model | CRUD (singleton) | `apps/backend/src/models/supplier.model.ts` | role-match (list CRUD shape, adapted to singleton) |
| `apps/backend/src/controllers/company.controller.ts` | controller | request-response | `apps/backend/src/controllers/supplier.controller.ts` | role-match |
| `apps/backend/src/routes/company.routes.ts` | route | request-response | `apps/backend/src/routes/supplier.routes.ts` | exact |
| `apps/backend/src/routes/index.ts` (register companyRoutes) | route | request-response | existing mounts in same file | exact |
| `apps/backend/src/utils/permitStatus.ts` | utility | transform (pure fn) | `apps/frontend/src/pages/LicensesPage.tsx` `computeStatus`/`handleExpiryChange` (client precedent to port) + `apps/backend/src/models/customerLicense.model.ts` `isLicenseValid` (server-side date-math precedent) | role-match (new file, no backend precedent, client logic promoted) |
| `apps/backend/src/models/license.model.ts` (extend) | model | CRUD | itself (existing file) + `customerLicense.model.ts` (relation `include`, computed status shaping) | exact |
| `apps/backend/src/controllers/license.controller.ts` (extend) | controller | request-response | itself (existing file) | exact |
| `apps/backend/src/routes/license.routes.ts` (no structural change) | route | request-response | itself | exact |
| `apps/backend/src/models/importOrder.model.ts` (add blocking check) | model | request-response (transactional gate) | `apps/backend/src/models/salesOrder.model.ts` `validateAndSnapshotLicense` pattern | exact (pattern to port, since importOrder has zero license-awareness today) |
| `apps/backend/src/models/salesOrder.model.ts` (add blocking check) | model | request-response (transactional gate) | itself — `validateAndSnapshotLicense` (lines 60-71) | exact |
| `apps/backend/prisma/seed.ts` (stop hand-setting daysRemaining/status) | config/seed | batch | itself (existing seed rows lines 257-264, 631-635) | exact |
| `apps/frontend/src/api/types.ts` (add `Company`, extend `License`) | model/types | transform | itself (existing `Supplier`/`License` interfaces) | exact |
| `apps/frontend/src/api/resources.ts` (add `companyApi`) | service | request-response | itself — `supplierApi`/`renewCustomerLicense` pattern | role-match (singleton needs custom `get`/`save`, not raw `createResourceApi`) |
| `apps/frontend/src/pages/CompanyPage.tsx` | component/page | request-response (singleton form) | `apps/frontend/src/pages/LicensesPage.tsx` (Modal/Field form internals) + `apps/frontend/src/components/ui/States.tsx` (EmptyState/ErrorState) | role-match (no existing singleton-page precedent; composed from list-page form parts) |
| `apps/frontend/src/pages/LicensesPage.tsx` (extend form + remove daysRemaining/status inputs) | component/page | CRUD | itself (existing file) | exact |
| `apps/frontend/src/pages/DashboardPage.tsx` (5-bucket permit section) | component/page | transform (client groupBy) | itself — `expiringLicenses`/`AlertCard` (existing 1-bucket pattern) | exact |
| `apps/frontend/src/pages/ImportOrdersPage.tsx` (add blockers UI) | component/page | request-response | `apps/frontend/src/pages/SalesOrdersPage.tsx` `validation.blockers` block (lines 112-150, 551-556) | exact (pattern to port; ImportOrdersPage has no blockers UI today) |
| `apps/frontend/src/pages/SalesOrdersPage.tsx` (extend blockers) | component/page | request-response | itself (existing `validation` useMemo + blocker rows) | exact |
| `apps/frontend/src/lib/status.ts` (add 6 new permit tier codes) | utility | transform | itself (existing `TONE_BY_CODE` map) | exact |
| `apps/frontend/src/components/layout/nav.ts` (add Company nav item) | config | — | itself (existing `NAV_GROUPS`) | exact |
| `apps/frontend/src/App.tsx` (register `/company` route) | route | — | itself (existing `<Route path="/licenses" .../>`) | exact |

## Pattern Assignments

### `apps/backend/src/models/company.model.ts` (model, CRUD/singleton)

**Analog:** `apps/backend/src/models/supplier.model.ts` (full file, 32 lines — read in full above)

**Core pattern to copy (verbatim shape, adapted to singleton):**
```typescript
import { prisma } from "../lib/prisma.js";

export const SupplierModel = {
  findAll: () => prisma.supplier.findMany({ orderBy: { supplierId: "asc" } }),
  findById: (supplierId: number) => prisma.supplier.findUnique({ where: { supplierId } }),
  create: (data: { supplierCode: string; supplierName: string; ... }) => prisma.supplier.create({ data }),
  update: (supplierId: number, data: Partial<{...}>) => prisma.supplier.update({ where: { supplierId }, data }),
  delete: (supplierId: number) => prisma.supplier.delete({ where: { supplierId } }),
};
```

**Singleton adaptation (Pitfall 4 in RESEARCH.md):** Do NOT expose `findAll`/`create-many`/`delete`. Instead:
```typescript
// CompanyModel shape — get-or-null + upsert, no list/delete
export const CompanyModel = {
  find: () => prisma.company.findFirst(),
  upsert: (data: { legalName: string; taxId: string; address: string }) =>
    prisma.company.upsert({
      where: { companyId: 1 }, // fixed singleton id, or findFirst-then-branch if id isn't pinned
      create: { companyId: 1, ...data },
      update: data,
    }),
};
```
No delete method — matches UI-SPEC.md "no delete button, no second row ever."

---

### `apps/backend/src/controllers/company.controller.ts` (controller, request-response)

**Analog:** `apps/backend/src/controllers/supplier.controller.ts` (full file, 42 lines — read in full above)

**Imports pattern (lines 1-3):**
```typescript
import { SupplierModel } from "../models/supplier.model.js";
import { HttpError } from "../middleware/errorHandler.js";
import { asyncHandler } from "../utils/asyncHandler.js";
```

**Core CRUD pattern (lines 5-21, adapted to singleton GET/PUT only):**
```typescript
export const getSupplier = asyncHandler(async (req, res) => {
  const supplier = await SupplierModel.findById(Number(req.params.id));
  if (!supplier) throw new HttpError(404, "Supplier not found");
  res.json(supplier);
});

export const createSupplier = asyncHandler(async (req, res) => {
  const { supplierCode, supplierName, country, contactName, email, phone, status } = req.body;
  if (!supplierCode || !supplierName) {
    throw new HttpError(400, "supplierCode and supplierName are required");
  }
  res.status(201).json(await SupplierModel.create({ supplierCode, supplierName, country, contactName, email, phone, status }));
});
```
Adapt to `getCompany` (returns `null` body, not 404, when no profile saved yet — UI-SPEC.md "empty state" expects a successful `null`/empty response, not an error) and `saveCompany` (manual required-field check for `legalName`/`taxId`/`address`, then `CompanyModel.upsert`).

---

### `apps/backend/src/routes/company.routes.ts` (route, request-response)

**Analog:** `apps/backend/src/routes/supplier.routes.ts` (full file, 18 lines — read in full above)

```typescript
import { Router } from "express";
import { getCompany, saveCompany } from "../controllers/company.controller.js";
import { requireAuth } from "../middleware/auth.js";

export const companyRoutes = Router();

companyRoutes.get("/", requireAuth, getCompany);
companyRoutes.put("/", requireAuth, saveCompany);
```
Only 2 routes (no POST list-create, no DELETE, no `:id` param) — singleton, not a list resource. Register in `apps/backend/src/routes/index.ts` following the exact existing mount pattern:
```typescript
// apps/backend/src/routes/index.ts line 19 (existing)
apiRoutes.use("/suppliers", supplierRoutes);
// add:
apiRoutes.use("/companies", companyRoutes);
```

---

### `apps/backend/src/utils/permitStatus.ts` (utility, transform)

**Analog (client-side precedent to port server-side):** `apps/frontend/src/pages/LicensesPage.tsx` lines 45-49, 98-103

**Existing 1-tier client pattern (verbatim):**
```typescript
function computeStatus(daysRemaining: number): string {
  if (daysRemaining < 0) return "EXPIRED";
  if (daysRemaining <= 30) return "EXPIRING_SOON";
  return "NORMAL";
}
// handleExpiryChange:
const handleExpiryChange = (expiryDate: string) => {
  const days = expiryDate
    ? Math.round((new Date(expiryDate).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000)
    : 0;
  setForm({ ...form, expiryDate, daysRemaining: String(days), status: computeStatus(days) });
};
```

**Server-side date-normalization precedent:** `apps/backend/src/models/customerLicense.model.ts` lines 7-11:
```typescript
export const isLicenseValid = (license: { status: CustomerLicenseStatus; expiryDate: Date }) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return license.status === CustomerLicenseStatus.ACTIVE && license.expiryDate >= today;
};
```

**Target implementation** (already drafted in RESEARCH.md Pattern 1, use verbatim):
```typescript
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
UI-SPEC.md color table confirms these exact 6 codes (`NORMAL`/`PREPARATION`/`NOTIFY`/`WARNING`/`IMPORTANT_WARNING`/`EXPIRED`) — use these names verbatim, not alternate tier names.

---

### `apps/backend/src/models/license.model.ts` (extend, CRUD)

**Analog:** itself (full file, 35 lines — read in full above) + `apps/backend/src/models/customerLicense.model.ts` for the `include`-relations + response-shaping pattern (lines 26-31: `withRelations` const, `include: withRelations` on every read).

**Current (to be replaced) create/update signature:**
```typescript
create: (data: {
  licenseNo: string; licenseType: string; holderName: string; category: string;
  issueDate: Date; expiryDate: Date; daysRemaining: number; status: string;
}) => prisma.license.create({ data }),
```

**Target pattern — strip `daysRemaining`/`status` from input, add `companyId`/`productId`, shape `status`/`daysRemaining` on every read via `computePermitStatus`:**
```typescript
import { computePermitStatus } from "../utils/permitStatus.js";

const withRelations = { company: true, product: true } as const;

const shape = (license: { expiryDate: Date; [k: string]: unknown }) => ({
  ...license,
  ...computePermitStatus(license.expiryDate),
});

export const LicenseModel = {
  findAll: async () => (await prisma.license.findMany({ orderBy: { expiryDate: "asc" }, include: withRelations })).map(shape),
  findById: async (licenseId: number) => {
    const license = await prisma.license.findUnique({ where: { licenseId }, include: withRelations });
    return license ? shape(license) : null;
  },
  create: (data: { licenseNo: string; licenseType: string; holderName: string; category: string; issueDate: Date; expiryDate: Date; companyId?: number | null; productId?: number | null }) =>
    prisma.license.create({ data, include: withRelations }).then(shape),
  // update follows same shape
};
```
Note: `daysRemaining`/`status` are entirely removed from the accepted input type per Pitfall 1 in RESEARCH.md.

---

### `apps/backend/src/controllers/license.controller.ts` (extend, request-response)

**Analog:** itself (full file, 57 lines — read in full above).

**Anti-pattern currently present (to remove per Pitfall 1):**
```typescript
// Current — lines 18-21 (MUST be removed/changed)
const { licenseNo, licenseType, holderName, category, issueDate, expiryDate, daysRemaining, status } = req.body;
if (!licenseNo || !licenseType || !holderName || !category || !issueDate || !expiryDate || daysRemaining == null || !status) {
  throw new HttpError(400, "licenseNo, licenseType, holderName, category, issueDate, expiryDate, daysRemaining, and status are required");
}
```
**Replacement pattern:** destructure `companyId`/`productId` instead of `daysRemaining`/`status`; drop those two from both the required-field check and the `LicenseModel.create`/`update` call. Keep the exact `optionalDate`/`optionalNumber` helper pattern (lines 5-6) for the new optional `companyId`/`productId` fields on update.

---

### `apps/backend/src/models/importOrder.model.ts` / `salesOrder.model.ts` (extend, blocking transactional gate)

**Analog (existing precedent, salesOrder.model.ts lines 60-71, verbatim):**
```typescript
const validateAndSnapshotLicense = async (tx: Prisma.TransactionClient, customerId: number, customerLicenseId: number) => {
  const license = await tx.customerLicense.findUnique({ where: { customerLicenseId } });
  if (!license) throw new HttpError(400, "Selected customer license not found");
  if (license.customerId !== customerId) throw new HttpError(400, "Selected license does not belong to this customer");
  if (!isLicenseValid(license)) throw new HttpError(400, "Selected license is not active or has expired");
  return { customerLicenseId: license.customerLicenseId, licenseNumberSnapshot: license.licenseNumber, licenseTypeSnapshot: license.licenseType, licenseExpirySnapshot: license.expiryDate };
};
```
Called inside `prisma.$transaction(async (tx) => { ... })` at the top of both `create` and the `items`-provided branch of `update` (see lines 96-97, 152-156).

**New shared helper to write (per RESEARCH.md Pitfall 3 — extract once, call from all 4 mutation entry points):**
```typescript
// New: apps/backend/src/utils/ or inline in a shared license-gate module
export const assertProductsNotBlockedTx = async (tx: Prisma.TransactionClient, productIds: number[]) => {
  const licenses = await tx.license.findMany({ where: { productId: { in: productIds } } });
  for (const license of licenses) {
    const { status } = computePermitStatus(license.expiryDate);
    if (status === "EXPIRED") {
      throw new HttpError(400, `Product ${license.productId} has an expired permit and cannot be ordered`);
    }
  }
};
```
Call sites (mirroring existing `validateAndSnapshotLicense` call sites exactly): `ImportOrderModel.create` (near line 80, before `tx.importOrder.create`), `ImportOrderModel.update` items-branch (near line 124), `SalesOrderModel.create` (line 96-97, alongside `validateAndSnapshotLicense`), `SalesOrderModel.update` items-branch (line 145-156, alongside existing license check).

**Error-handling pattern to reuse:** `HttpError(400, ...)` thrown inside the `tx` callback aborts the whole `$transaction` — no partial writes, matching every other model's `HttpError(404, "X not found")` pre-check idiom used throughout this codebase.

---

### `apps/frontend/src/api/types.ts` (extend types)

**Analog:** itself — `Supplier` interface (lines 9-18) for the new `Company` interface shape; `License` interface (lines 86-96) for the extension.

```typescript
// Add:
export interface Company {
  companyId: number;
  legalName: string;
  taxId: string;
  address: string;
}

// Extend License (remove daysRemaining/status as writable, they remain read-only computed fields returned by the API):
export interface License {
  licenseId: number;
  licenseNo: string;
  licenseType: string;
  holderName: string;
  category: string;
  issueDate: string;
  expiryDate: string;
  daysRemaining: number; // still present in API response (computed), just not accepted on write
  status: string;        // now one of NORMAL/PREPARATION/NOTIFY/WARNING/IMPORTANT_WARNING/EXPIRED
  companyId: number | null;
  productId: number | null;
  company?: Company;
  product?: Product;
}
```

---

### `apps/frontend/src/api/resources.ts` (extend)

**Analog:** itself — `supplierApi` (line 17) for the resource-registration convention; `renewCustomerLicense` (lines 25-28) for a hand-written non-CRUD `request()` call pattern to copy for the singleton GET/PUT.

```typescript
// Existing pattern for a custom non-list endpoint (lines 25-28, verbatim):
export const renewCustomerLicense = (
  customerLicenseId: number,
  body: { licenseNumber: string; issueDate: string; expiryDate: string; documentUrl?: string; notes?: string; actor?: string },
) => request<CustomerLicense>(`/customer-licenses/${customerLicenseId}/renew`, { method: "POST", body: JSON.stringify(body) });
```

**Target — companyApi (singleton, not createResourceApi list):**
```typescript
export const companyApi = {
  get: () => request<Company | null>("/companies"),
  save: (body: { legalName: string; taxId: string; address: string }) =>
    request<Company>("/companies", { method: "PUT", body: JSON.stringify(body) }),
};
```
Do NOT use `createResourceApi<Company>("/companies")` — that generic helper assumes `list`/`create`/`update(id)`/`remove(id)`, which contradicts the singleton contract (Pitfall 4, UI-SPEC.md "no delete button, no + Add button").

---

### `apps/frontend/src/pages/CompanyPage.tsx` (new, singleton settings form)

**Analog (form/modal internals):** `apps/frontend/src/pages/LicensesPage.tsx` `Field`/`FormGrid`/`TextInput` usage (lines 250-291) and `handleSubmit`/toast pattern (lines 105-132). **Analog (empty/error states):** `apps/frontend/src/components/ui/States.tsx` `EmptyState`/`ErrorState` used at `LicensesPage.tsx` lines 222-225.

**Imports pattern to copy:**
```typescript
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { companyApi } from "../api/resources";
import type { Company } from "../api/types";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Field, FormGrid, TextInput } from "../components/ui/Field";
import { PageHeader } from "../components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { useToast } from "../components/ui/Toast";
```

**Core pattern:** GET-on-mount (no `useResource` — that hook assumes a list; write a small local `useEffect`/`useState` following the same `loading`/`error`/`saving` shape `useResource` establishes, lines 16-32 of `useResource.ts`), single `Card` > `FormGrid` > `Field`/`TextInput` for legalName/taxId/address, one right-aligned `Button variant="primary"` labeled exactly `"Save Company Profile"` (Copywriting Contract) calling `companyApi.save`. On `null` GET result, render inline form pre-filled empty with the "No company profile yet" / helper copy from UI-SPEC.md rather than a blocking `EmptyState` with no action (per UI-SPEC.md item 1: "create-via-save-once behavior").

**Error handling pattern (copy from LicensesPage.tsx `handleSubmit` lines 129-131):**
```typescript
} catch (err) {
  toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
}
```

---

### `apps/frontend/src/pages/LicensesPage.tsx` (extend)

**Analog:** itself (full file, 306 lines — read in full above).

**Changes required:**
1. Remove `daysRemaining`/`status` from `FormState` (lines 20-29), `emptyForm` (lines 31-40), `STATUS_OPTIONS`/`computeStatus`/`handleExpiryChange` special-casing (lines 42, 45-49, 98-103) — expiry date change no longer needs to compute/set status client-side (server computes on read).
2. Add `companyId`/`productId` to `FormState`, using the exact `SelectField` pattern already used for `category` (lines 254-262):
```typescript
<Field label={t("license.field.company")}>
  <SelectField value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })}>
    <option value="">-- None --</option>
    {companies.map((c) => <option key={c.companyId} value={c.companyId}>{c.legalName}</option>)}
  </SelectField>
</Field>
```
3. Replace the editable `daysRemaining`/`status` `Field`s (lines 279-290) with **read-only** `Badge` display in the table only (already exists at lines 156-168 via `statusTone(r.status)` — keep this, just remove the corresponding form inputs).
4. `handleSubmit` payload (lines 111-120): drop `daysRemaining`/`status` keys entirely; add `companyId`/`productId`.

---

### `apps/frontend/src/pages/DashboardPage.tsx` (extend, 5-bucket grouping)

**Analog:** itself — `expiringLicenses` `useMemo` (line 34) and `AlertCard` component (lines 198-228), both to be replaced/extended for the "Permit Deadlines" card.

**Existing 1-bucket pattern (line 34, to be replaced):**
```typescript
const expiringLicenses = useMemo(() => licenses.filter((l) => l.daysRemaining <= 30), [licenses]);
```

**Target 5-bucket pattern (client-side groupBy, same `useMemo` technique, scaled up per UI-SPEC.md item 3):**
```typescript
const permitBuckets = useMemo(() => {
  const buckets: Record<string, number> = { PREPARATION: 0, NOTIFY: 0, WARNING: 0, IMPORTANT_WARNING: 0, EXPIRED: 0 };
  for (const l of licenses) {
    if (l.status in buckets) buckets[l.status] += 1;
  }
  return buckets;
}, [licenses]);
```
Render as a `grid grid-cols-2 sm:grid-cols-5 gap-4` row of `p-4` tone-tinted tiles (per UI-SPEC.md item 3), each linking to `/licenses` — reuse the `<Link to="...">` wrapper pattern from `AlertCard` (lines 215-227), but as new plain `div` tiles (not the existing `AlertCard`/`StatCard` components — UI-SPEC.md explicitly calls for new plain tiles, not reused Card components, for on-grid spacing control).

**Copy per UI-SPEC.md:** section heading "Permit Deadlines"; tile labels "Preparation (120d)" / "Notify (90d)" / "Warning (60d)" / "Important Warning (30d)" / "Expired".

---

### `apps/frontend/src/pages/ImportOrdersPage.tsx` (new blocking UI) / `SalesOrdersPage.tsx` (extend blocking UI)

**Analog:** `apps/frontend/src/pages/SalesOrdersPage.tsx` `validation` `useMemo` (lines 112-150) and blocker-row rendering (lines 551-562) — full pattern read above.

**Validation-array pattern to copy verbatim shape (lines 112-150):**
```typescript
const validation = useMemo(() => {
  const blockers: string[] = [];
  const warnings: string[] = [];
  for (const [productId, qty] of quantityByProduct) {
    const product = products.find((p) => String(p.productId) === productId);
    if (!product) continue;
    // existing checks...
  }
  // NEW: add expired-permit check here
  for (const [productId] of quantityByProduct) {
    const license = licenses.find((l) => String(l.productId) === productId);
    if (license?.status === "EXPIRED") {
      blockers.push(t("importOrder.validation.permitExpired")); // or salesOrder.validation.permitExpired
    }
  }
  return { blockers, warnings, needsApproval };
}, [/* deps incl. licenses */]);
const canSubmit = validation.blockers.length === 0 && !validation.needsApproval;
```

**Blocker-row rendering pattern to copy verbatim (lines 551-556):**
```typescript
{validation.blockers.map((msg) => (
  <div key={msg} className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
    <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
    <span>{msg}</span>
  </div>
))}
```
`ImportOrdersPage.tsx` has zero existing `validation`/blockers infrastructure — this entire block (state, `useMemo`, rendering) must be introduced there for the first time, copying `SalesOrdersPage.tsx` structure, not just the message.

**Copy (UI-SPEC.md, exact string):** "This product's permit has expired. Renew the permit before creating new orders for it."

---

### `apps/frontend/src/lib/status.ts` (extend)

**Analog:** itself — `TONE_BY_CODE` map (lines 3-38), `// license.status` section (lines 16-19).

**Current 3-code license section (lines 16-19, to be extended not replaced — keep old codes for backward-compat since RESEARCH.md doesn't mandate dropping them from the tone map, only from the license `status` field's *new* value set):**
```typescript
  // license.status
  NORMAL: "success",
  EXPIRING_SOON: "warning",
  EXPIRED: "danger",
```

**Target — add 3 new permit tier codes (UI-SPEC.md color table, exact tone mapping):**
```typescript
  // license.status (permit tiers, Phase 7)
  NORMAL: "success",
  PREPARATION: "neutral",
  NOTIFY: "info",
  WARNING: "warning",
  IMPORTANT_WARNING: "warning",
  EXPIRED: "danger",
```
`EXPIRING_SOON` can be removed if `computePermitStatus` no longer emits it (replaced by `WARNING`/`IMPORTANT_WARNING`) — confirm with planner whether any other code path still reads/writes `EXPIRING_SOON`.

---

## Shared Patterns

### `requireAuth`-only routing (no RBAC exists)
**Source:** `apps/backend/src/routes/supplier.routes.ts` (every route wrapped in `requireAuth` only, no permission middleware)
**Apply to:** `company.routes.ts` (new), unchanged `license.routes.ts`
```typescript
companyRoutes.get("/", requireAuth, getCompany);
companyRoutes.put("/", requireAuth, saveCompany);
```

### Manual field validation (no zod outside auth.controller.ts)
**Source:** `apps/backend/src/controllers/supplier.controller.ts` lines 17-19
**Apply to:** `company.controller.ts`, extended `license.controller.ts`
```typescript
if (!supplierCode || !supplierName) {
  throw new HttpError(400, "supplierCode and supplierName are required");
}
```

### Transactional pre-check that aborts on invalid state
**Source:** `apps/backend/src/models/salesOrder.model.ts` `validateAndSnapshotLicense` (lines 60-71), called inside `prisma.$transaction`
**Apply to:** `importOrder.model.ts` (new), `salesOrder.model.ts` (extend) — all 4 mutation entry points (create/update × import/sales)
```typescript
return prisma.$transaction(async (tx) => {
  await assertProductsNotBlockedTx(tx, productIds); // throws HttpError(400,...) -> transaction aborts, no rows written
  // ...proceed with create/update
});
```

### Computed-on-read fields never trusted from request body
**Source:** RESEARCH.md Pattern 1 (new — no prior backend precedent; client precedent at `LicensesPage.tsx` lines 45-49)
**Apply to:** `license.model.ts` findAll/findById response shaping via `permitStatus.ts`
```typescript
const shape = (license) => ({ ...license, ...computePermitStatus(license.expiryDate) });
```

### `statusTone`-driven Badge coloring
**Source:** `apps/frontend/src/lib/status.ts` `statusTone()` + `apps/frontend/src/components/ui/Badge.tsx` (unchanged)
**Apply to:** License table status badge, Dashboard permit bucket tiles
```typescript
<Badge tone={statusTone(r.status)}>{t(`status.license.${r.status}`, r.status)}</Badge>
```

### Toast + try/catch on save
**Source:** `apps/frontend/src/pages/LicensesPage.tsx` `handleSubmit` (lines 105-132)
**Apply to:** `CompanyPage.tsx` save handler
```typescript
try {
  await companyApi.save(payload);
  toast.success(t("company.toast.saved"));
} catch (err) {
  toast.error(err instanceof Error ? err.message : t("common.saveFailed"));
}
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/frontend/src/pages/CompanyPage.tsx` (singleton-form-as-page shell) | component/page | request-response | No prior page in this codebase renders a single-record settings form (every existing page is a `DataTable` list); composed from LicensesPage's Modal/Field internals + States.tsx per Pattern Assignments section above — not a true 1:1 analog, flagged for planner attention on layout details (PageHeader with no filters/actions except final page-bottom button, per UI-SPEC.md item 1) |

## Metadata

**Analog search scope:** `apps/backend/src/{models,controllers,routes}`, `apps/backend/prisma/schema.prisma`, `apps/frontend/src/{pages,api,lib,components/ui,hooks}`
**Files scanned:** 24 backend + 20 frontend (via Glob), 16 read in full for pattern extraction
**Pattern extraction date:** 2026-09-11
