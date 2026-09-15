# Plan 03-09 Summary: Pre-existing test migration sweep

**Status:** Complete — no code changes required (verified, not assumed)

## What happened

This plan's objective was to migrate 5 pre-existing test files off the removed
`SalesOrderItem.lotBatch` string field, plus confirm a 6th file needed no change.

By the time Wave 5 started, 5 of the 6 target files had already been migrated as a
side effect of Wave 3:
- `salesOrder.license-block.test.ts`, `order.genericUpdateRestriction.test.ts`,
  `audit.crud.orders.test.ts`, `models.txClient.test.ts`,
  `rbac.enforcement.writes.orders.test.ts` — all fixed by 03-04-PLAN.md's executor,
  which discovered these files broke as a direct consequence of the
  `lotBatch` → `inventoryStockId` rename it was making and fixed them in the same
  worktree (documented in 03-04-SUMMARY.md's "Deviations" section).

The 6th file, `rbac.enforcement.writes.batchB.test.ts`, was never touched because
it never needed to be: its two `lotBatch` occurrences are `InventoryStock` fixture
creation (`prisma.inventoryStock.create({ data: { lotBatch: ... } })`), not
`SalesOrderItem` payload construction — `InventoryStock.lotBatch` was not renamed
by this phase, only `SalesOrderItem.lotBatch` was.

## Verification performed (not skipped)

- `grep -n "lotBatch"` across all 6 target files — confirmed every remaining
  occurrence is legitimate `InventoryStock` fixture usage, not a stale
  `SalesOrderItem` payload reference.
- Checked the plan's specific T-03-23 threat concern: whether
  `rbac.enforcement.writes.batchB.test.ts` asserts `quantityOnHand` persists via
  `PUT /api/inventory-stock/:id` (which 03-03-PLAN.md made a no-op field). Grepped
  the file — it only uses `POST /api/inventory-stocks` (create, where
  `quantityOnHand` is still legitimately writable) and `DELETE`. No `PUT` exists in
  this file at all. Threat does not apply.
- Ran the plan's exact verification command:
  `npx vitest run tests/salesOrder.license-block.test.ts tests/order.genericUpdateRestriction.test.ts tests/audit.crud.orders.test.ts tests/models.txClient.test.ts tests/rbac.enforcement.writes.orders.test.ts tests/rbac.enforcement.writes.batchB.test.ts`
  — 6/6 files, 22/22 tests passed.

## Deviations

None in the traditional sense — no files were modified because the work was
already done by 03-04, and the 6th file required no change. This is documented
per plan-checker/verifier precedent (03-08 hit a similar "already correct, verify
and document" outcome for its own scope).

## Files touched

None.
