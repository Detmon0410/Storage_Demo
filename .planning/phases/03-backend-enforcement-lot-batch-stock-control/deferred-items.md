# Deferred Items — Phase 03

Out-of-scope issues discovered during plan execution but not fixed (per executor SCOPE BOUNDARY rule).

## From 03-02

- **`tests/models.txClient.test.ts` — "SalesOrderModel.create with no client arg still works..." test fails.**
  Cause: `apps/backend/src/models/salesOrder.model.ts` (lines ~115, ~174) still constructs `SalesOrderItem` create data using the old free-text `lotBatch` field, which 03-01-PLAN.md's schema migration replaced with a required `inventoryStockId` FK (`Argument \`product\` is missing` / Prisma validation error surfaces because the old shape no longer matches the generated types).
  This is pre-existing breakage introduced by 03-01's schema change, not by 03-02's files (`lotGate.ts`, `creditDiscountGate.ts`, `stockTransaction.model.ts`). 03-01-SUMMARY.md already flagged this exact issue ("apps/backend/src/models/salesOrder.model.ts ... still references the old lotBatch field and now fails tsc --noEmit ... presumably addressed by a later plan in this phase's wave").
  Expected to be fixed by 03-04-PLAN.md (sales order enforcement wiring), which per 03-02-PLAN.md's own objective is responsible for wiring `inventoryStockId` into `salesOrder.model.ts`.
