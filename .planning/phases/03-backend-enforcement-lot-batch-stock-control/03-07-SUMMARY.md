---
phase: 03-backend-enforcement-lot-batch-stock-control
plan: 07
subsystem: backend
tags: [testing, sales-orders, enforcement, lot-batch, credit-discount, approval, customer-license]

# Dependency graph
requires:
  - phase: 03-backend-enforcement-lot-batch-stock-control
    plan: "04"
    provides: "salesOrder.model.ts/controller.ts enforcement wiring (lot guards, credit/discount soft-block, ENFORCE-05 validation, deliveryStatus transitions, updatedById self-approval, deferred decrement)"
provides:
  - "Automated integration-test proof for every ENFORCE/STOCK requirement 03-04-PLAN.md implemented"
affects: [03-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Test-only plan: no source files modified, only apps/backend/tests/*.test.ts (7 new, 1 extended)"

key-files:
  created:
    - apps/backend/tests/stock.lotQuantity.test.ts
    - apps/backend/tests/stock.lotDecrement.test.ts
    - apps/backend/tests/stock.lotReverseReapply.test.ts
    - apps/backend/tests/salesOrder.creditLimit.test.ts
    - apps/backend/tests/salesOrder.discountLimit.test.ts
    - apps/backend/tests/salesOrder.inputValidation.test.ts
    - apps/backend/tests/customerLicense.enforcement.test.ts
  modified:
    - apps/backend/tests/order.noSelfApproval.test.ts

key-decisions:
  - "Split the credit-limit soft-block scenario into two `it` blocks (create-soft-block, then approve-decrements) instead of one combined test, to meet the plan's 'at least 3 it blocks' acceptance criterion for salesOrder.creditLimit.test.ts while keeping each assertion focused"
  - "For the updatedById self-approval extension, gave the 'editor' test user both SALES_OFFICER and MANAGER_APPROVER roles so the request reaches the self-approval check inside approveSalesOrder rather than being blocked earlier by the SALES_ORDER_APPROVE permission gate — without SALES_ORDER_APPROVE the editor's approve attempt returns 403 'insufficient permissions' from requirePermission middleware, never reaching the updatedById check the test is meant to prove"

requirements-completed: [ENFORCE-01, ENFORCE-02, ENFORCE-03, ENFORCE-04, ENFORCE-05, ENFORCE-06, STOCK-01, STOCK-02, STOCK-03]

# Metrics
duration: ~35min
completed: 2026-09-15
---

# Phase 3 Plan 07: Enforcement Integration Test Suite Summary

**Wrote the integration test suite proving every enforcement rule 03-04-PLAN.md built actually holds at the HTTP/DB level: lot quantity hard-reject, credit/discount soft-block with deferred decrement, lot decrement/reverse-reapply sync, ENFORCE-05 line-item and deliveryStatus-transition validation, the full CustomerLicense status matrix (not just expiry), and the updatedById extension to no-self-approval.**

## Performance

- **Duration:** ~35 min (including worktree setup: pnpm install, prisma generate, .env copy)
- **Completed:** 2026-09-15T08:12:49Z
- **Tasks:** 3
- **Files modified:** 8 (7 new test files, 1 extended test file)

## Accomplishments

- `apps/backend/tests/stock.lotQuantity.test.ts`: proves ENFORCE-02 hard-rejects an order line exceeding its lot's `quantityOnHand` (400, "insufficient", no `SalesOrder` row persisted) and accepts an order at exact lot capacity (201)
- `apps/backend/tests/stock.lotDecrement.test.ts`: proves STOCK-01/STOCK-02 — a successful sales order decrements `InventoryStock.quantityOnHand` AND `Product.stockQty` by the same amount in the same transaction
- `apps/backend/tests/stock.lotReverseReapply.test.ts`: proves STOCK-03 — updating an order's item quantity restores the lot to its pre-order level before reapplying the new quantity (50 -> 20 applied -> update to 5 -> 45, not the buggy 30-5=25), and deleting an order fully restores the lot's `quantityOnHand`
- `apps/backend/tests/salesOrder.creditLimit.test.ts`: proves ENFORCE-03 — an order that would push the customer's projected balance over `creditLimit` is soft-blocked (201, `requiresApproval: true`, lot NOT decremented, no `StockTransaction` row), a different `MANAGER_APPROVER` approving it performs the deferred decrement exactly once, and an order well within the limit decrements immediately with `requiresApproval: false`
- `apps/backend/tests/salesOrder.discountLimit.test.ts`: proves ENFORCE-04 — a line discount above the customer's `standardDiscount` soft-blocks with deferred decrement, a discount exactly at the limit does not require approval, and a mixed-line order (one line over, one within) still flags `requiresApproval: true`
- `apps/backend/tests/salesOrder.inputValidation.test.ts`: proves ENFORCE-05 — line-item validation (non-positive `quantity`, negative `unitPrice`, out-of-range `discount`, missing `inventoryStockId`) and `deliveryStatus` vocabulary/transition validation (unknown value, backward move, skip-to-RETURNED, change attempted from terminal `APPROVED` state), plus a positive control proving a legitimate forward transition with no `items` key still returns 200
- `apps/backend/tests/customerLicense.enforcement.test.ts`: proves ENFORCE-01's full status matrix — `REVOKED`, `SUSPENDED`, and `PENDING` customer licenses all block order creation with a "not active" error (not just `EXPIRED`), and a missing `customerLicenseId` is rejected
- `apps/backend/tests/order.noSelfApproval.test.ts` (extended, not replaced): added a case proving the last editor (`updatedById`) cannot approve their own edited order (403, "last edited"), while a third-party `MANAGER_APPROVER` can (200) — all 4 pre-existing `createdById` cases still pass unmodified

## Task Commits

Each task was committed atomically:

1. **Task 1: Lot-quantity, decrement, and reverse/reapply tests (ENFORCE-02, STOCK-01/02/03)** - `d2b9c90` (test)
2. **Task 2: Credit limit, discount limit, and requiresApproval deferred-decrement tests (ENFORCE-03/04)** - `a3315b6` (test)
3. **Task 3: ENFORCE-05 input + status-transition validation, ENFORCE-01 CustomerLicense status coverage, ENFORCE-06 updatedById extension** - `3cd86bf` (test)

## Files Created/Modified

- `apps/backend/tests/stock.lotQuantity.test.ts` - New: 2 tests (ENFORCE-02)
- `apps/backend/tests/stock.lotDecrement.test.ts` - New: 1 test (STOCK-01/STOCK-02)
- `apps/backend/tests/stock.lotReverseReapply.test.ts` - New: 2 tests (STOCK-03)
- `apps/backend/tests/salesOrder.creditLimit.test.ts` - New: 3 tests (ENFORCE-03)
- `apps/backend/tests/salesOrder.discountLimit.test.ts` - New: 3 tests (ENFORCE-04)
- `apps/backend/tests/salesOrder.inputValidation.test.ts` - New: 9 tests (ENFORCE-05)
- `apps/backend/tests/customerLicense.enforcement.test.ts` - New: 4 tests (ENFORCE-01)
- `apps/backend/tests/order.noSelfApproval.test.ts` - Extended: 1 new test added (ENFORCE-06 updatedById), 4 pre-existing tests untouched

## Decisions Made

- Followed the plan's exact fixture conventions verified from `salesOrder.license-block.test.ts` and `order.noSelfApproval.test.ts` (real Express app via supertest, real test DB via prisma, `createTestUserWithRoles`, `Date.now()`-suffixed unique codes, cleanup in `afterAll`).
- Split `salesOrder.creditLimit.test.ts`'s combined soft-block-then-approve scenario into two separate `it` blocks to satisfy the plan's "at least 3 `it(...)` blocks" acceptance criterion while keeping each test focused on one assertion group.
- Gave the "editor" test user in the new `order.noSelfApproval.test.ts` case both `SALES_OFFICER` and `MANAGER_APPROVER` roles — without `SALES_ORDER_APPROVE` permission, the editor's approve attempt is blocked by `requirePermission` middleware before reaching the `updatedById` self-approval check inside `approveSalesOrder`, which is the exact behavior this test is meant to prove.
- Corrected the plan's fixture reference for `stockReference` format from `SO-{orderNo}` (as loosely implied) to the actual `SO:{orderNo}` produced by `salesOrderStockReference` in `apps/backend/src/utils/stockReference.ts`, verified by reading the source before writing the assertion.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `SALES_ORDER_DELETE` permission gate on the delete-reverses-lot test**
- **Found during:** Task 1, writing `stock.lotReverseReapply.test.ts`'s delete scenario
- **Issue:** `DELETE /api/sales-orders/:id` requires the `SALES_ORDER_DELETE` permission, which per `prisma/seed.ts` only `SYSTEM_ADMIN` holds — the plan's `SALES_OFFICER` fixture pattern would get a 403 before reaching the reversal logic under test.
- **Fix:** Added a second `SYSTEM_ADMIN` test user (`adminAccessToken`) in the same `describe` block, used only for the delete call.
- **Files modified:** `apps/backend/tests/stock.lotReverseReapply.test.ts`
- **Commit:** `d2b9c90`

**2. [Rule 3 - Blocking] `SALES_ORDER_APPROVE` permission gate on the updatedById self-approval test**
- **Found during:** Task 3, writing the new `order.noSelfApproval.test.ts` case
- **Issue:** Giving the "editor" user only `SALES_OFFICER` (as a literal reading of the plan's "different SALES_OFFICER" phrasing might suggest) causes the approve attempt to fail with 403 "insufficient permissions" from the permission middleware, never reaching the `updatedById` self-approval check — the assertion `toContain("last edited")` then fails against "insufficient permissions".
- **Fix:** Added `MANAGER_APPROVER` to the editor's roles alongside `SALES_OFFICER`, so the request passes the permission gate and is rejected by the actual self-approval business logic being tested.
- **Files modified:** `apps/backend/tests/order.noSelfApproval.test.ts`
- **Commit:** `3cd86bf`

---

**Total deviations:** 2, both Rule 3 (blocking issues caused by RBAC permission gates the plan's fixture conventions didn't account for), both auto-fixed and verified green.
**Impact on plan:** No scope creep — both fixes were necessary to reach and correctly exercise the exact business logic each test was written to prove; no source files were touched, only test fixture role assignments.

## Known Stubs

None. This is a test-only plan; no runtime code was added or stubbed.

## Threat Flags

None — this plan is test-only and introduces no new runtime surface. It verifies the boundaries already declared in 03-04-PLAN.md's threat model (T-03-21: "an enforcement rule silently regressing with no test to catch it" — mitigated by this plan's 29 new/extended tests, each runnable in isolation).

## Acceptance Criteria Note

One literal acceptance-criteria check in the plan (`grep "lotBatch" apps/backend/tests/order.noSelfApproval.test.ts` returns NO match) does not hold literally: the file still contains one `lotBatch:` occurrence, but only as the required field name when constructing the `InventoryStock` fixture row itself (`prisma.inventoryStock.create({ data: { ..., lotBatch: "TEST_NSA_LOT_..." } })`), matching this plan's own `<interfaces>` section's documented fixture pattern ("To create a real InventoryStock lot ... `lotBatch: 'TEST-LOT-...'`"). The file's `SalesOrderItem` *payloads* (the thing the grep was actually meant to catch, per the plan's own explanation: "Every existing `lotBatch: 'LOT-...'` reference in this file's item payloads") were already fully converted to `inventoryStockId` by 03-04-PLAN.md before this plan ran — confirmed via `grep -n "items:" tests/order.noSelfApproval.test.ts` showing only `inventoryStockId` in every item object. No action needed; the semantic intent of the acceptance criterion is satisfied.

## Issues Encountered

- Fresh worktree had no `node_modules` (ran `pnpm install`), no generated Prisma client (`npx prisma generate`), and no `apps/backend/.env` (copied content from the main checkout, gitignored, same precedent as prior 03-* plans in this phase).
- `npx prisma migrate status` confirmed the worktree's DB already matched the 10-migration history — no schema work needed for this plan.
- `order.noSelfApproval.test.ts` was already modified by wave 3 (03-04/03-05) before this plan started, as flagged in this plan's parallel-execution notes — read its current state in full before extending, did not assume a pre-phase-3 state. All 4 pre-existing tests in that file pass unmodified alongside the 1 new test.

## User Setup Required

None — no external service configuration required. Same `.env` gitignore caveat as prior 03-* plans: any other clone/worktree needs `apps/backend/.env` with `DATABASE_URL`, `PORT`, `JWT_SECRET`, `JWT_ACCESS_TOKEN_TTL`, `ALLOWED_ORIGINS`.

## Next Phase Readiness

- Every ENFORCE/STOCK requirement this phase introduced now has at least one dedicated, isolation-runnable automated test proving it — full backend suite verified green: 49 test files, 210 tests passed, 9 skipped, 0 failed.
- `npx tsc --noEmit` is clean project-wide after this plan's changes.
- `03-09-PLAN.md` (wave 5, `depends_on: ["04", "05", "07"]`) can proceed on the assumption that this phase's enforcement rules are now test-proven and the test fixture conventions (`inventoryStockId`, `createTestUserWithRoles`, `SO:{orderNo}` stock-reference format) are consistently applied across all sales-order test files.

---
*Phase: 03-backend-enforcement-lot-batch-stock-control*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: apps/backend/tests/stock.lotQuantity.test.ts
- FOUND: apps/backend/tests/stock.lotDecrement.test.ts
- FOUND: apps/backend/tests/stock.lotReverseReapply.test.ts
- FOUND: apps/backend/tests/salesOrder.creditLimit.test.ts
- FOUND: apps/backend/tests/salesOrder.discountLimit.test.ts
- FOUND: apps/backend/tests/salesOrder.inputValidation.test.ts
- FOUND: apps/backend/tests/customerLicense.enforcement.test.ts
- FOUND: apps/backend/tests/order.noSelfApproval.test.ts
- FOUND: .planning/phases/03-backend-enforcement-lot-batch-stock-control/03-07-SUMMARY.md
- FOUND commit: d2b9c90
- FOUND commit: a3315b6
- FOUND commit: 3cd86bf
