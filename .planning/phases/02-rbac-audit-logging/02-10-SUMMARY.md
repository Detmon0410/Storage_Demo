---
phase: 02-rbac-audit-logging
plan: 10
subsystem: api
tags: [prisma, express, rbac, audit-logging, approval-workflow]

# Dependency graph
requires:
  - phase: 02-rbac-audit-logging
    provides: tx-injected ImportOrderModel/SalesOrderModel (plan 02-04), AuditLogModel.record (plan 02-03), IMPORT_ORDER_*/SALES_ORDER_* permission codes and RBAC read enforcement (plan 02-06)
provides:
  - Audited create/update/delete for ImportOrder and SalesOrder using tx-injected models
  - Permission-gated write routes (CREATE/EDIT/DELETE/APPROVE) for both order types
  - POST /:id/approve and /:id/reject endpoints for ImportOrder and SalesOrder with no-self-approval enforcement
  - Generic PUT /:id endpoints can no longer set status to APPROVED/REJECTED
affects: [phase 4 approval workflow (status machine will replace this minimal approve/reject), phase 3 backend enforcement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Controller opens prisma.$transaction, calls tx-injected Model.create/update/delete, then AuditLogModel.record(tx, ...) inside the same transaction (mirrors category.controller.ts pattern from plan 02-03)"
    - "Approve/reject endpoints re-fetch the row inside the tx, check createdById !== req.userId before mutating, resolve approver display name via tx.user.findUnique, and store reject reason in the audit after-snapshot (no dedicated column yet)"

key-files:
  created:
    - apps/backend/tests/audit.crud.orders.test.ts
    - apps/backend/tests/order.noSelfApproval.test.ts
    - apps/backend/tests/rbac.enforcement.writes.orders.test.ts
    - apps/backend/tests/order.genericUpdateRestriction.test.ts
  modified:
    - apps/backend/src/controllers/importOrder.controller.ts
    - apps/backend/src/controllers/salesOrder.controller.ts
    - apps/backend/src/routes/importOrder.routes.ts
    - apps/backend/src/routes/salesOrder.routes.ts
    - apps/backend/tests/importOrder.license-block.test.ts
    - apps/backend/tests/salesOrder.license-block.test.ts

key-decisions:
  - "reject reuses the same *_APPROVE permission as approve, per the role doc's matrix (no separate reject permission code exists)"
  - "SalesOrder has no separate 'status' column - the APPROVED/REJECTED restriction and approve/reject transitions operate on the existing deliveryStatus field"
  - "rejectionReason captured in the AuditLog after-JSON snapshot rather than a new DB column, since Phase 4 owns the real status-machine schema"
  - "approver display name resolved via tx.user.findUnique with graceful null fallback (T-02-22, accepted risk - AuditLog.userId remains authoritative)"

patterns-established:
  - "Order approve/reject endpoint shape: fetch existing inside tx -> no-self-approval check -> resolve approver username -> update -> AuditLogModel.record -> return"

requirements-completed: [RBAC-04, AUDIT-01, AUDIT-02]

# Metrics
duration: 25min
completed: 2026-09-14
---

# Phase 02 Plan 10: Order Audit, Approve/Reject, and Bypass Closure Summary

**Audited ImportOrder/SalesOrder CRUD, added permission-gated approve/reject endpoints enforcing no-self-approval, and closed the generic-PUT status bypass.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-14T07:00:00Z (approx)
- **Completed:** 2026-09-14T07:06:00Z (approx)
- **Tasks:** 3 completed
- **Files modified:** 10 (4 test files created, 2 test files fixed, 4 source files modified)

## Accomplishments
- ImportOrder and SalesOrder create/update/delete now run inside `prisma.$transaction` using the tx-injected models from plan 02-04, each producing an `AuditLogModel` row (create/update/delete)
- `createdById: req.userId` now set on order creation, making no-self-approval enforceable
- New `POST /api/import-orders/:id/approve`, `/:id/reject`, `POST /api/sales-orders/:id/approve`, `/:id/reject` endpoints, gated by `IMPORT_ORDER_APPROVE`/`SALES_ORDER_APPROVE`, reject the order's own creator with 403, and record an `approve`/`reject` AuditLog row
- Generic `PUT /:id` on both order types now rejects (400) any attempt to set `status`/`deliveryStatus` to `APPROVED` or `REJECTED`, closing the bypass path CONTEXT.md flagged, while leaving all other status transitions unaffected
- All CREATE/EDIT/DELETE write routes for both order types are now permission-gated (previously only GET routes were gated, from plan 02-06)

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit-wrap create/update/delete for ImportOrder and SalesOrder (tx-injected models)** - `821ab7c` (feat)
2. **Task 2: Approve/reject endpoints with no-self-approval enforcement** - `14bb665` (test, RED) + `f3210e9` (feat, GREEN)
3. **Task 3: Restrict generic PUT from setting status to APPROVED/REJECTED** - `677ae30` (fix)

_TDD task (Task 2) has separate RED/GREEN commits as required._

## Files Created/Modified
- `apps/backend/src/controllers/importOrder.controller.ts` - CRUD audit-wrapped with tx-injected model calls; approve/reject added; generic PUT restricted
- `apps/backend/src/controllers/salesOrder.controller.ts` - Same treatment for SalesOrder (using `deliveryStatus` in place of `status`)
- `apps/backend/src/routes/importOrder.routes.ts` - POST/PUT/DELETE gated by IMPORT_ORDER_CREATE/EDIT/DELETE; new `/:id/approve` and `/:id/reject` routes gated by IMPORT_ORDER_APPROVE
- `apps/backend/src/routes/salesOrder.routes.ts` - Same treatment with SALES_ORDER_* codes
- `apps/backend/tests/audit.crud.orders.test.ts` - Create+update+delete round-trip on both order types, asserts matching AuditLog rows and regression-checks the linked stock transaction side effect
- `apps/backend/tests/order.noSelfApproval.test.ts` - 4 behaviors: self-approval 403, different-approver 200, same for reject, and null-createdById approval allowed
- `apps/backend/tests/rbac.enforcement.writes.orders.test.ts` - `it.each` coverage of denied/allowed roles on both order types' approve endpoint
- `apps/backend/tests/order.genericUpdateRestriction.test.ts` - PUT with APPROVED/REJECTED returns 400; other status values still succeed
- `apps/backend/tests/importOrder.license-block.test.ts` / `salesOrder.license-block.test.ts` - Fixed to use permissioned test users (see Deviations)

## Decisions Made
- Reject uses the same `*_APPROVE` permission as approve (role doc does not split them)
- `rejectionReason` stored in the AuditLog `after` JSON snapshot rather than a new schema column (Phase 4 owns the real status machine)
- `approver` field resolved via a `tx.user.findUnique` lookup with a graceful `null` fallback rather than storing `req.userId` as a numeric placeholder

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing license-block tests broken by new permission gates**
- **Found during:** Task 1 (permission-gating POST/PUT/DELETE on order routes)
- **Issue:** `apps/backend/tests/importOrder.license-block.test.ts` and `salesOrder.license-block.test.ts` created test users via `createTestUser` (no roles/permissions). Once Task 1 added `requirePermission("IMPORT_ORDER_CREATE"|"SALES_ORDER_CREATE"|...)` to the write routes, these existing tests started failing with 403 instead of their expected 400/201 responses — a direct regression caused by this task's route changes.
- **Fix:** Switched both files to `createTestUserWithRoles(..., ["IMPORT_COMPLIANCE_OFFICER"])` / `["SALES_OFFICER"])` respectively, matching the roles the seed data grants CREATE/EDIT permission to for each entity.
- **Files modified:** `apps/backend/tests/importOrder.license-block.test.ts`, `apps/backend/tests/salesOrder.license-block.test.ts`
- **Verification:** Both files pass; full backend suite (`pnpm --filter backend test`) passes with 30 files / 120 tests / 9 skipped, 0 failed.
- **Committed in:** `821ab7c` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug/regression)
**Impact on plan:** Necessary fix to keep the pre-existing test suite green after intentionally permission-gating the order write routes per this plan's objective. No scope creep — no other files touched.

## Issues Encountered
None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Order CRUD is now fully audited and permission-gated; approve/reject with no-self-approval is live ahead of Phase 4's full status machine
- Phase 4 (Approval Workflow) should replace this minimal approve/reject with the full DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED state machine, add a dedicated `rejectionReason` column, and revisit whether stock deduction should move from order-create to the APPROVED transition (per STATE.md's existing blocker note)
- No blockers for the remaining Phase 02 plans

## Self-Check: PASSED

- FOUND: apps/backend/src/controllers/importOrder.controller.ts
- FOUND: apps/backend/src/controllers/salesOrder.controller.ts
- FOUND: apps/backend/src/routes/importOrder.routes.ts
- FOUND: apps/backend/src/routes/salesOrder.routes.ts
- FOUND: apps/backend/tests/audit.crud.orders.test.ts
- FOUND: apps/backend/tests/order.noSelfApproval.test.ts
- FOUND: apps/backend/tests/rbac.enforcement.writes.orders.test.ts
- FOUND: apps/backend/tests/order.genericUpdateRestriction.test.ts
- FOUND commit: 821ab7c
- FOUND commit: 14bb665
- FOUND commit: f3210e9
- FOUND commit: 677ae30

---
*Phase: 02-rbac-audit-logging*
*Completed: 2026-09-14*
