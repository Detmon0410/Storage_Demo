---
phase: 07-company-profile-permit-deadlines
plan: 03
subsystem: backend
tags: [prisma, mysql, express, vitest, tdd, license-enforcement]

# Dependency graph
requires: ["07-01"]
provides:
  - "assertProductsNotBlockedTx(tx, productIds) shared transactional pre-check in apps/backend/src/utils/licenseGate.ts"
  - "Backend-enforced order-blocking gate wired into all 4 mutation entry points (sales create/update-with-items, import create/update-with-items)"
affects: ["07-08"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Transactional pre-check idiom: assertProductsNotBlockedTx(tx, productIds) called as the first statement inside prisma.$transaction(async (tx) => {...}) callbacks, mirroring the existing validateAndSnapshotLicense pattern — a thrown HttpError aborts the whole transaction with zero partial writes"

key-files:
  created:
    - apps/backend/src/utils/licenseGate.ts
    - apps/backend/tests/licenseGate.test.ts
    - apps/backend/tests/salesOrder.license-block.test.ts
    - apps/backend/tests/importOrder.license-block.test.ts
  modified:
    - apps/backend/src/models/salesOrder.model.ts
    - apps/backend/src/models/importOrder.model.ts

key-decisions:
  - "Coverage for assertProductsNotBlockedTx was NOT folded into Task 2/3's integration tests — it has its own dedicated tests/licenseGate.test.ts covering the unit-level RED/GREEN TDD cycle (EXPIRED-block, no-license passthrough, future-expiry passthrough, empty-array no-op) using a real test transaction, separate from the supertest-level integration tests in Task 2/3 that exercise the full HTTP request path."
  - "importOrder.model.ts update's items-branch runs assertProductsNotBlockedTx AFTER the existing-order lookup (for a cleaner 404-before-400 precedence) but still BEFORE reverseAndDeleteByReferenceTx, satisfying the plan's 'before reverseAndDeleteByReferenceTx' requirement and the zero-partial-writes truth."

requirements-completed: [PERMIT-04]

# Metrics
duration: 40min
completed: 2026-09-14
---

# Phase 07 Plan 03: Backend Order-Blocking Gate for Expired Permits Summary

**Shared `assertProductsNotBlockedTx` transactional helper wired into all 4 sales/import order create+update-with-items entry points, rejecting any product whose linked License is EXPIRED with a 400 inside the same DB transaction as the order write — closing the core-value gap of frontend-only enforcement.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 3 completed
- **Files modified:** 6 (2 new src files if counting test files: 1 new util, 1 new test file for it, 2 new integration test files, 2 modified model files)

## Accomplishments

- Implemented `assertProductsNotBlockedTx(tx, productIds)` in `apps/backend/src/utils/licenseGate.ts`, following full TDD (RED test commit confirming module-not-found, then GREEN implementation commit confirming all 4 unit tests pass)
- Wired the gate into `SalesOrderModel.create` and the items-branch of `SalesOrderModel.update`, as the first statement inside each `$transaction` callback, before `validateAndSnapshotLicense`/`reverseAndDeleteByReferenceTx`
- Wired the gate into `ImportOrderModel.create` and the items-branch of `ImportOrderModel.update`, closing RESEARCH.md Pitfall 2 (import orders previously had zero license-awareness)
- Added 3 real supertest-driven integration tests per order type (create-block, create-allow, update-with-items-block), each proving via direct `prisma.findUnique` that no order row is persisted when the block fires (transaction rollback proof)
- Full backend test suite (58 tests across 13 files, including the 3 new license-block/gate test files) passes green

## Task Commits

Each task was committed atomically:

1. **Task 1: assertProductsNotBlockedTx shared helper** - `8cac758` (test, RED) → `3bdab30` (feat, GREEN)
2. **Task 2: Wire blocking gate into SalesOrderModel (create + update)** - `4adf152` (feat)
3. **Task 3: Wire blocking gate into ImportOrderModel (create + update)** - `1a76be6` (feat)

**Plan metadata:** (this commit, docs: complete plan)

_Note: Task 1 was TDD — test committed first and confirmed failing (module not found: `../src/utils/licenseGate.js`), then implementation committed and confirmed all 4 tests passing._

## Files Created/Modified

- `apps/backend/src/utils/licenseGate.ts` - `assertProductsNotBlockedTx(tx, productIds)`: dedupes/filters productIds, no-ops on empty array, queries `tx.license.findMany({ where: { productId: { in: uniqueIds } } })`, throws `HttpError(400, ...)` mentioning the product/license when `computePermitStatus(license.expiryDate).status === "EXPIRED"`
- `apps/backend/tests/licenseGate.test.ts` - 4 unit/integration tests against a real DB transaction: EXPIRED throws 400 mentioning productId, no-license-linked resolves, future-expiry resolves, empty array resolves without querying
- `apps/backend/src/models/salesOrder.model.ts` - Imports `assertProductsNotBlockedTx`; calls it as the first statement in `create`'s `$transaction` and in `update`'s items-branch `$transaction` (before `validateAndSnapshotLicense`/`reverseAndDeleteByReferenceTx`)
- `apps/backend/tests/salesOrder.license-block.test.ts` - 3 supertest integration tests: POST blocked for expired-permit product (400, "expired permit" in error, no row persisted), POST allowed for no-license product (201), PUT-with-items blocked when adding an expired-permit product to an existing order (400)
- `apps/backend/src/models/importOrder.model.ts` - Imports `assertProductsNotBlockedTx`; calls it as the first statement in `create`'s `$transaction` and (after the existing-order 404 check, before `reverseAndDeleteByReferenceTx`) in `update`'s items-branch `$transaction`
- `apps/backend/tests/importOrder.license-block.test.ts` - 3 supertest integration tests mirroring the sales-order suite, adapted for import orders (no Customer/CustomerLicense fixtures needed)

## Decisions Made

- Task 1's helper coverage lives in its own dedicated `licenseGate.test.ts` (not folded into Task 2/3), giving a clean unit-level TDD RED/GREEN pair separate from the HTTP-level integration tests — explicitly not double-counted per the plan's note.
- In `ImportOrderModel.update`'s items branch, `assertProductsNotBlockedTx` is called immediately after the existing-order lookup/404 check rather than as the literal first line, so a request against a non-existent order still returns 404 (not 400) — this still satisfies the plan's core requirement that the check runs before `reverseAndDeleteByReferenceTx` and inside the same transaction as the write.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored local .env, installed workspace dependencies, and ran `prisma generate` in this worktree**
- **Found during:** Task setup (before Task 1)
- **Issue:** This worktree had no `node_modules`, no `apps/backend/.env`, and a stale/absent generated Prisma Client, blocking `npx prisma generate`, `npx vitest`, and any DB access entirely
- **Fix:** Ran `pnpm install --frozen-lockfile` at the repo root; copied `apps/backend/.env` from the main repo checkout (gitignored, untracked, not part of any commit); ran `npx prisma generate` per the parallel-execution note (schema already pushed live by Plan 07-01, no `db push` needed)
- **Files modified:** none tracked (node_modules, .env, and generated Prisma Client are all gitignored/local-only)
- **Verification:** `npx prisma generate` succeeded; full test suite ran and passed against the live shared dev DB
- **Committed in:** N/A (no trackable file changes — local environment setup only)

**2. [Rule 1 - Bug] Test cleanup needed to delete StockTransaction rows before deleting test Products**
- **Found during:** Task 2 (salesOrder.license-block.test.ts first run)
- **Issue:** `SalesOrderModel.create`/`ImportOrderModel.create` auto-generate `StockTransaction` rows referencing the test products; the initial `afterAll` cleanup tried to delete products before those stock-transaction rows, hitting a FK constraint violation
- **Fix:** Added `prisma.stockTransaction.deleteMany({ where: { productId: { in: [...] } } })` before the product deleteMany in both `salesOrder.license-block.test.ts` and `importOrder.license-block.test.ts` cleanup blocks
- **Files modified:** `apps/backend/tests/salesOrder.license-block.test.ts`, `apps/backend/tests/importOrder.license-block.test.ts`
- **Verification:** Both test files pass cleanly with no leftover rows or FK errors on repeated runs
- **Committed in:** `4adf152`, `1a76be6` (folded into the same commits since the files were newly created in those tasks, not yet committed when the fix was made)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Environment setup only for #1; #2 is a self-contained test-fixture correctness fix with no impact on production code or scope.

## Issues Encountered

- A transient failure in the pre-existing `tests/company.test.ts` (unrelated to this plan's files) was observed on the first full-suite run — likely a race with the concurrently-executing Plan 07-02 worktree writing to the shared dev DB. It was not reproducible on the final full-suite run (58/58 passed), so no fix was needed and no deviation was logged for it.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The backend order-blocking gate (PERMIT-04) is fully enforced and test-covered; Plan 07-08 (frontend blocker UI) can now build a non-authoritative UX convenience layer on top of this authoritative backend gate, per the threat model's T-07-08 disposition.
- `assertProductsNotBlockedTx` is exported and reusable by any future order-mutation entry point that needs the same expired-permit check.

---
*Phase: 07-company-profile-permit-deadlines*
*Completed: 2026-09-14*

## Self-Check: PASSED

All created files confirmed present on disk (licenseGate.ts, licenseGate.test.ts, salesOrder.license-block.test.ts, importOrder.license-block.test.ts). All 4 task commits (8cac758, 3bdab30, 4adf152, 1a76be6) confirmed present in `git log`. Full backend test suite: 58/58 passed across 13 files.
