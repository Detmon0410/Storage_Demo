# Deferred Items — Phase 03

Out-of-scope issues discovered during plan execution but not fixed (per executor SCOPE BOUNDARY rule).

## From 03-02

- **`tests/models.txClient.test.ts` — "SalesOrderModel.create with no client arg still works..." test fails.**
  Cause: `apps/backend/src/models/salesOrder.model.ts` (lines ~115, ~174) still constructs `SalesOrderItem` create data using the old free-text `lotBatch` field, which 03-01-PLAN.md's schema migration replaced with a required `inventoryStockId` FK (`Argument \`product\` is missing` / Prisma validation error surfaces because the old shape no longer matches the generated types).
  This is pre-existing breakage introduced by 03-01's schema change, not by 03-02's files (`lotGate.ts`, `creditDiscountGate.ts`, `stockTransaction.model.ts`). 03-01-SUMMARY.md already flagged this exact issue ("apps/backend/src/models/salesOrder.model.ts ... still references the old lotBatch field and now fails tsc --noEmit ... presumably addressed by a later plan in this phase's wave").
  Expected to be fixed by 03-04-PLAN.md (sales order enforcement wiring), which per 03-02-PLAN.md's own objective is responsible for wiring `inventoryStockId` into `salesOrder.model.ts`.
  **RESOLVED by 03-04**: `SalesOrderItemInput.lotBatch` replaced with `inventoryStockId` throughout `salesOrder.model.ts`/`salesOrder.controller.ts`; `tests/models.txClient.test.ts` updated to seed an `InventoryStock` row and pass `inventoryStockId` instead of `lotBatch`.

## From 03-04

- **`apps/frontend/src/pages/SalesOrdersPage.tsx` still submits `lotBatch` in sales order item payloads.**
  The frontend sales order create/edit form was not touched by this plan (out of `files_modified` scope — only `apps/backend/src/models/salesOrder.model.ts` and `apps/backend/src/controllers/salesOrder.controller.ts`). Since the backend now requires `inventoryStockId` instead of `lotBatch` on each line item, any direct-from-browser sales order create/update via this page will now fail with a 400 ("each item requires productId, quantity, unitPrice, discount, and inventoryStockId") until the frontend is updated.
  Already scoped and expected to be fixed by **03-06-PLAN.md**, whose `files_modified` explicitly lists `apps/frontend/src/api/types.ts` and `apps/frontend/src/pages/SalesOrdersPage.tsx`. Not a regression to fix here — flagging for completeness.

- **Additional pre-existing test files using `lotBatch` in sales-order item payloads fixed as a direct consequence of this plan's interface change** (in scope per Rule 1/3 — these tests would otherwise fail to compile/pass against the new `inventoryStockId`-based interface): `tests/salesOrder.license-block.test.ts`, `tests/audit.crud.orders.test.ts`, `tests/order.genericUpdateRestriction.test.ts`, `tests/order.noSelfApproval.test.ts`, `tests/rbac.enforcement.writes.orders.test.ts`. Each now seeds an `InventoryStock` row per product used and passes `inventoryStockId` in sales-order item payloads instead of `lotBatch`. Full `npx vitest run` suite is green except one pre-existing flaky test (`tests/audit.atomicity.test.ts`, passes in isolation, fails intermittently in full-suite runs due to cross-file auth/rate-limit interaction — confirmed unrelated to this plan's changes).
