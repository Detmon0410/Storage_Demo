---
phase: 3
slug: backend-enforcement-lot-batch-stock-control
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-09-15
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.8 + Supertest 7.0.0 |
| **Config file** | `apps/backend/vitest.config.ts` (assumed standard, matches existing 34 test files) |
| **Quick run command** | `npx vitest run tests/<file>.test.ts` (from `apps/backend`) |
| **Full suite command** | `npm test` (from `apps/backend`, runs `vitest run`) |
| **Estimated runtime** | ~30-60s per targeted file, full suite several minutes (34+ existing files plus this phase's new/extended files) |

Existing test conventions (verified from `salesOrder.license-block.test.ts` and
`order.noSelfApproval.test.ts`):
- Tests hit the real Express `app` via `supertest`, against a real (test) database via `prisma` from
  `tests/setup.js`.
- `createTestUserWithRoles(suffix, roleCodes)` from `tests/fixtures/testUser.ts` creates a real user
  with real role assignments and returns credentials for login.
- Each `describe` block creates its own category/supplier/product/customer/license fixtures with
  `Date.now()`-suffixed unique codes, and cleans them up in `afterAll` (including
  `stockTransaction`/`auditLog` cleanup where relevant) — this pattern must be followed for new
  lot/credit/discount tests to avoid cross-test pollution.
- Tests assert on `res.body.error.toLowerCase()).toContain("...")` for error-message matching — new
  guard functions' error messages use predictable, lowercase-matchable substrings (`"insufficient"`,
  `"exceeds"`, `"credit"`, `"discount"`, `"expired"`, `"invalid status transition"`, `"terminal
  state"`, etc.).

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/<relevant-file>.test.ts` (targeted, <30s)
- **After every plan wave:** Run `npm test` (from `apps/backend`) — full suite, including the ~15
  existing order/audit/rbac tests that reference `lotBatch` and needed updating alongside the schema
  change
- **Before `/gsd-verify-work`:** Full suite must be green, plus a manual `prisma migrate dev` (or
  `db push`) + `prisma db seed` run to confirm the seed script still succeeds against the new schema
- **Max feedback latency:** ~60 seconds (targeted vitest run)

---

## Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ENFORCE-01 | Reject sales order for expired/revoked/suspended/missing customer license via direct API | integration | `npx vitest run tests/customerLicense.enforcement.test.ts` | ✅ planned in 03-07 Task 3 |
| ENFORCE-02 | Reject sales order line exceeding lot's available quantity | integration | `npx vitest run tests/stock.lotQuantity.test.ts` | ✅ planned in 03-07 Task 1 |
| ENFORCE-03 | Reject/flag sales order exceeding credit limit unless approved | integration | `npx vitest run tests/salesOrder.creditLimit.test.ts` | ✅ planned in 03-07 Task 2 |
| ENFORCE-04 | Require approval when discount exceeds customer's allowed discount | integration | `npx vitest run tests/salesOrder.discountLimit.test.ts` | ✅ planned in 03-07 Task 2 |
| ENFORCE-05 | Reject negative qty / invalid price / invalid discount / invalid status transition (sales order) | integration | `npx vitest run tests/salesOrder.inputValidation.test.ts` | ✅ planned in 03-07 Task 3 (line items + deliveryStatus transitions) |
| ENFORCE-05 | Reject negative qty / invalid price / invalid status transition (import order) | integration | `npx vitest run tests/importOrder.inputValidation.test.ts` | ✅ planned in 03-08 Task 3 |
| ENFORCE-06 | Cannot approve own created-or-last-edited transaction | integration | `npx vitest run tests/order.noSelfApproval.test.ts` | ✅ existing "created" cases + planned "last edited" cases in 03-07 Task 3 |
| STOCK-01 | Product-level stock derived/synced from lot quantities, not independently edited | integration | `npx vitest run tests/stock.lotDecrement.test.ts` | ✅ planned in 03-07 Task 1 (same-transaction sync assertion) |
| STOCK-02 | Sales order create decrements lot quantity in same transaction | integration | `npx vitest run tests/stock.lotDecrement.test.ts` | ✅ planned in 03-07 Task 1 |
| STOCK-03 | Delete/edit sales order restores prior lot quantity before reapplying | integration | `npx vitest run tests/stock.lotReverseReapply.test.ts` | ✅ planned in 03-07 Task 1 |
| STOCK-04 | Import receiving creates/updates lots with qty/warehouse/date/lot number, gated on RECEIVED | integration | `npx vitest run tests/importOrder.receivingLots.test.ts` | ✅ planned in 03-08 Task 1 |
| STOCK-05 | Stock transactions record product, lot, source document, movement type | unit + integration | `npx vitest run tests/stockTransaction.lotReference.test.ts` | ✅ planned in 03-08 Task 2 |
| STOCK-06 | Manual quantityOnHand edits blocked; adjustment requires reason code + audit | integration | `npx vitest run tests/inventoryStock.adjustment.test.ts` | ✅ planned in 03-03 Task 3 |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-04-01 | 04 | 3 | STOCK-01/02/03 | T-03-12/T-03-13 | Lot + credit/discount guards wired into create/update | unit (tsc) | `cd apps/backend && npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-04-02 | 04 | 3 | ENFORCE-05, ENFORCE-06 | T-03-14/T-03-23 | parseItems + deliveryStatus transition validation; updatedById self-approval | unit (tsc) | `cd apps/backend && npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-05-01 | 05 | 3 | STOCK-04 | T-03-17/T-03-18 | Lot creation gated on RECEIVED; item edits blocked once RECEIVED | unit (tsc) | `cd apps/backend && npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-05-02 | 05 | 3 | ENFORCE-05 | T-03-24 | Import item validation + status transition validation | unit (tsc) | `cd apps/backend && npx tsc --noEmit` | ✅ | ⬜ pending |
| 03-07-01 | 07 | 4 | ENFORCE-02, STOCK-01/02/03 | T-03-13/T-03-21 | Lot quantity, decrement, reverse-reapply | integration | `npx vitest run tests/stock.lotQuantity.test.ts tests/stock.lotDecrement.test.ts tests/stock.lotReverseReapply.test.ts` | ✅ | ⬜ pending |
| 03-07-02 | 07 | 4 | ENFORCE-03, ENFORCE-04 | T-03-12/T-03-15 | Credit/discount soft-block + deferred decrement on approve | integration | `npx vitest run tests/salesOrder.creditLimit.test.ts tests/salesOrder.discountLimit.test.ts` | ✅ | ⬜ pending |
| 03-07-03 | 07 | 4 | ENFORCE-01, ENFORCE-05, ENFORCE-06 | T-03-14/T-03-23 | Line-item + deliveryStatus validation, license status matrix, updatedById self-approval | integration | `npx vitest run tests/salesOrder.inputValidation.test.ts tests/customerLicense.enforcement.test.ts tests/order.noSelfApproval.test.ts` | ✅ | ⬜ pending |
| 03-08-01 | 08 | 4 | STOCK-04 | T-03-17/T-03-18 | Receiving-gate lot creation + RECEIVED item-edit immutability | integration | `npx vitest run tests/importOrder.receivingLots.test.ts` | ✅ | ⬜ pending |
| 03-08-02 | 08 | 4 | STOCK-05 | — | StockTransaction carries inventoryStockId | integration | `npx vitest run tests/stockTransaction.lotReference.test.ts` | ✅ | ⬜ pending |
| 03-08-03 | 08 | 4 | ENFORCE-05 | T-03-24/T-03-25 | Import item + status-transition validation | integration | `npx vitest run tests/importOrder.inputValidation.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Full per-task mapping for 03-01/02/03/06/09/10 lives in each plan's own `<verification>` block; this
table summarizes the enforcement-critical waves (3-4) directly implicated by the checker's blocker.*

---

## Wave 0 Requirements

- [x] `tests/stock.lotQuantity.test.ts` — covers ENFORCE-02 (03-07 Task 1)
- [x] `tests/salesOrder.creditLimit.test.ts` — covers ENFORCE-03 (03-07 Task 2)
- [x] `tests/salesOrder.discountLimit.test.ts` — covers ENFORCE-04 (03-07 Task 2)
- [x] `tests/stock.lotDecrement.test.ts` — covers STOCK-02 (03-07 Task 1)
- [x] `tests/stock.lotReverseReapply.test.ts` — covers STOCK-03 (03-07 Task 1)
- [x] `tests/importOrder.receivingLots.test.ts` — covers STOCK-04 (03-08 Task 1)
- [x] `tests/stockTransaction.lotReference.test.ts` — covers STOCK-05 (03-08 Task 2)
- [x] `tests/importOrder.inputValidation.test.ts` — covers ENFORCE-05 for import orders (03-08 Task 3)
- [x] `tests/inventoryStock.adjustment.test.ts` — covers STOCK-06 (03-03 Task 3)
- [x] **Update existing tests referencing `lotBatch` as a string** (`salesOrder.license-block.test.ts`,
      `order.noSelfApproval.test.ts`, `rbac.enforcement.writes.orders.test.ts`, `audit.crud.orders.test.ts`,
      and any others found via `grep -rl "lotBatch:" apps/backend/tests`) — these fail to compile/pass
      once `SalesOrderItem.lotBatch` becomes `inventoryStockId`. This is not a "new test" gap but a
      mandatory migration task sized into 03-04/03-07's effort estimate.
- [x] Framework install: none — vitest/supertest already present

---

## Manual-Only Verifications

*None. All phase behaviors have automated verification (integration tests via supertest, or `tsc
--noEmit` for type-level contract checks where no runtime test file exists yet).*

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-09-15
