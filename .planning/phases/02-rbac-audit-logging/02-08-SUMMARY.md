---
phase: 02-rbac-audit-logging
plan: 08
subsystem: api
tags: [rbac, audit-logging, prisma, express, transaction]

requires:
  - phase: 02-rbac-audit-logging
    provides: "GET-route permission gating for customer/customerLicense/dashboardKpi/license/supplier (plan 02-05); AuditLogModel.record + Client tx-injection pattern (plans 02-01/02-03/02-04)"
provides:
  - "Audit-wrapped, permission-gated create/update/delete for Customer, CustomerLicense (incl. two-row renewal audit), DashboardKpi, License, Supplier"
  - "CustomerLicenseModel.create/update extended to accept a tx-injected client, matching the renew() pattern from plan 02-04"
affects: [02-09, 02-10, audit-logging-verification, rbac-verification]

tech-stack:
  added: []
  patterns:
    - "Controller-owned prisma.$transaction wrapping tx.<entity>.create/update/delete + AuditLogModel.record(tx, ...), for modules whose model layer has no business logic worth preserving"
    - "Model-owned tx pass-through (client: Client = prisma trailing param) for modules whose model layer has real logic (actor tracking, computed shape) that must run inside the controller's transaction"

key-files:
  created:
    - apps/backend/tests/audit.crud.batchA.test.ts
    - apps/backend/tests/rbac.enforcement.writes.batchA.test.ts
  modified:
    - apps/backend/src/models/customerLicense.model.ts
    - apps/backend/src/controllers/customerLicense.controller.ts
    - apps/backend/src/controllers/customer.controller.ts
    - apps/backend/src/controllers/dashboardKpi.controller.ts
    - apps/backend/src/controllers/license.controller.ts
    - apps/backend/src/controllers/supplier.controller.ts
    - apps/backend/src/routes/customer.routes.ts
    - apps/backend/src/routes/customerLicense.routes.ts
    - apps/backend/src/routes/dashboardKpi.routes.ts
    - apps/backend/src/routes/license.routes.ts
    - apps/backend/src/routes/supplier.routes.ts

key-decisions:
  - "License's model layer does have business logic (company/product relations, computePermitStatus shaping) despite the plan's interfaces table assuming plain CRUD for it — restored that shaping in the controller (include + shape()) to avoid regressing license.test.ts"
  - "CustomerLicense renewal audit for the old license is only recorded when the old license wasn't already EXPIRED, matching CustomerLicenseModel.renew's own conditional update — avoids a spurious update audit row on an already-expired license"

requirements-completed: [RBAC-04, AUDIT-01]

duration: 35min
completed: 2026-09-14
---

# Phase 02 Plan 08: RBAC + Audit for Customer/CustomerLicense/DashboardKpi/License/Supplier Summary

**5 business-module controllers (customer, customerLicense, dashboardKpi, license, supplier) now wrap create/update/delete in `prisma.$transaction` with atomic `AuditLogModel.record` calls and enforce write-permission codes on their routes, including a two-row audit trail for CustomerLicense renewal.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-14T13:53:00+07:00 (worktree setup)
- **Completed:** 2026-09-14T14:00:52+07:00
- **Tasks:** 2/2 completed
- **Files modified:** 11 modified, 2 created

## Accomplishments

- CustomerLicenseModel's `create`/`update` extended with a `client: Client = prisma` trailing parameter (matching plan 02-04's `renew` pattern), letting the controller pass its own transaction through instead of bypassing the model
- customerLicense controller's `renew` produces exactly two atomic audit rows within the same transaction as the renewal writes: an `update` on the old (now-expired) license and a `create` on the new license
- Customer, DashboardKpi, License, Supplier controllers rewritten to open `prisma.$transaction`, call `tx.<entity>.create/update/delete` directly, and record `create`/`update`/`delete` audit events with correct `before`/`after` snapshots
- All 5 modules' POST/PUT/DELETE routes gated with the correct permission codes (`CUSTOMER_*`, `CUSTOMER_LICENSE_*`, `DASHBOARD_MANAGE`, `LICENSE_*`, `SUPPLIER_*`) per the plan's interface matrix
- Two new test files: `audit.crud.batchA.test.ts` (Supplier create/update/delete audit round-trip) and `rbac.enforcement.writes.batchA.test.ts` (403 coverage for Customer DELETE, Supplier POST, DashboardKpi POST by a non-privileged role)

## Task Commits

1. **Task 1: Extend CustomerLicenseModel's Client type to create/update; audit-wrap + permission-gate customerLicense controller/routes** - `04dc3a9` (feat)
2. **Task 2: Audit-wrap + permission-gate customer, dashboardKpi, license, supplier controllers/routes** - `7f0220f` (feat)

## Files Created/Modified

- `apps/backend/src/models/customerLicense.model.ts` - `create`/`update` accept a tx-injected `client`; `update`'s internal not-found lookup now reads via `client` instead of the singleton
- `apps/backend/src/controllers/customerLicense.controller.ts` - create/update/delete/renew each open `prisma.$transaction`; renew records two audit rows (old-expire update + new-license create)
- `apps/backend/src/controllers/customer.controller.ts` - create/update/delete audit-wrapped via `tx.customer.*`
- `apps/backend/src/controllers/dashboardKpi.controller.ts` - create/update/delete audit-wrapped via `tx.dashboardKpi.*`
- `apps/backend/src/controllers/license.controller.ts` - create/update/delete audit-wrapped via `tx.license.*`, preserving `company`/`product` relation includes and `computePermitStatus` response shaping
- `apps/backend/src/controllers/supplier.controller.ts` - create/update/delete audit-wrapped via `tx.supplier.*`
- `apps/backend/src/routes/customer.routes.ts`, `customerLicense.routes.ts`, `dashboardKpi.routes.ts`, `license.routes.ts`, `supplier.routes.ts` - `requirePermission(...)` added to POST/PUT/DELETE (and `POST /:id/renew` for customerLicense)
- `apps/backend/tests/audit.crud.batchA.test.ts` - Supplier create+update+delete produce matching AuditLog rows
- `apps/backend/tests/rbac.enforcement.writes.batchA.test.ts` - 403-denial coverage for Customer DELETE, Supplier POST, DashboardKpi POST by SALES_OFFICER

## Decisions Made

- License's model layer was found to have real business logic (relation includes + computed permit status) contrary to the plan's assumption of plain CRUD for this module — preserved that behavior in the controller rather than dropping it, to avoid regressing `license.test.ts`'s assertions on `company`/`product`/`status` fields in create/update responses.
- CustomerLicense renewal's old-license audit `update` row is only written when the old license wasn't already `EXPIRED`, mirroring `CustomerLicenseModel.renew`'s own conditional `tx.customerLicense.update` call — prevents a misleading audit entry claiming a status change that didn't happen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Preserved License's relation includes and computed permit-status shaping**
- **Found during:** Task 2 (audit-wrap license.controller.ts)
- **Issue:** The plan's `<interfaces>` table classified License as having "no business logic worth preserving," but `LicenseModel.create`/`update` actually apply `include: { company: true, product: true }` and a `shape()` function computing `daysRemaining`/`status` via `computePermitStatus`. A literal `tx.license.create(...)` without these would drop the `company`/`product`/`status` fields from API responses, breaking existing consumers.
- **Fix:** Added the same `withRelations` include and `shape()` computation directly in the controller, applied to the transaction-created/updated record before sending the response (audit records still capture the raw persisted row).
- **Files modified:** `apps/backend/src/controllers/license.controller.ts`
- **Verification:** `pnpm exec vitest run tests/license.test.ts` — all 7 tests pass (3 were failing before this fix, asserting `company`/`product`/`status` presence)
- **Committed in:** `7f0220f` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1)
**Impact on plan:** Necessary correctness fix to avoid regressing existing License API consumers; no scope creep beyond the plan's stated files.

## Issues Encountered

- The worktree had no `node_modules` and no `apps/backend/.env` (both are gitignored and not part of the worktree checkout). Ran `pnpm install --frozen-lockfile` and `npx prisma generate` to enable type-checking, then copied `.env` from the main repo checkout to run the test suite against the shared dev database. No repository files were changed by this setup.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plans 02-09 and 02-10 (running in parallel in this same wave) cover the remaining 5 business modules — no file overlap with this plan.
- Full backend test suite (`pnpm exec vitest run`, 28 files / 110 passing / 9 skipped) passes with this plan's changes applied, confirming no regressions to prior RBAC/audit work.
- CustomerLicense's `Client`-typed model methods (`create`, `update`, `renew`) are now consistent, so any future controller needing to compose CustomerLicense writes into a larger transaction can do so directly.

---
*Phase: 02-rbac-audit-logging*
*Completed: 2026-09-14*

## Self-Check: PASSED

All 8 files created/modified verified present on disk; both task commits (`04dc3a9`, `7f0220f`) verified present in `git log`.
