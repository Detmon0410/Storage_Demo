---
phase: 04-approval-workflow
plan: 02
subsystem: backend-models
tags: [prisma, approval-workflow, stock-decrement, regression-risk]

# Dependency graph
requires:
  - phase: 04-approval-workflow
    plan: 01
    provides: OrderStatus enum, ImportOrder.logisticsStatus rename, approval-field split, importValueGate.ts
provides:
  - "salesOrder.model.ts: status-derived stock decrement (status === \"APPROVED\") in create() and update()"
  - "importOrder.model.ts: value-threshold-derived status on create(), dual logisticsStatus+status gate on lot creation"
affects: [04-03, 04-04, 04-05, 04-06, frontend-approval-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-condition gate (logisticsStatus === RECEIVED && status === APPROVED) required anywhere stock lots are created from an import order, to prevent an approval-bypass regression"

key-files:
  created: []
  modified:
    - apps/backend/src/models/salesOrder.model.ts
    - apps/backend/src/models/importOrder.model.ts

key-decisions:
  - "Followed the plan's exact action blocks verbatim (both tasks) — no functional deviation from the specified rewrite shape."

requirements-completed: [APPROVAL-02, APPROVAL-03, APPROVAL-05]

# Metrics
duration: ~25min
completed: 2026-09-16
---

# Phase 4 Plan 2: Approval-Aware Model Rewiring Summary

**salesOrder.model.ts and importOrder.model.ts now derive OrderStatus from their respective soft-block guards (credit/discount gate, new import value-threshold gate) and gate stock effects strictly on status === "APPROVED", closing the highest-risk regression point in the phase — the import-order RECEIVED lot-creation path now requires BOTH logisticsStatus === "RECEIVED" AND status === "APPROVED".**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-09-16
- **Completed:** 2026-09-16
- **Tasks:** 2
- **Files modified:** 2 (salesOrder.model.ts, importOrder.model.ts)

## Accomplishments
- `salesOrder.model.ts`: `create()` and `update()` compute `status: OrderStatus` (`"PENDING_APPROVAL"` or `"APPROVED"`) from `applyLotGuardsTx`'s `requiresApproval` result, replacing the removed `requiresApproval` boolean write; stock decrement (`createStockOutTx`) now gated on `status === "APPROVED"` in both methods. Removed the free-text `approver` field entirely.
- `importOrder.model.ts`: `create()` computes `totalValue` from order items and calls the new `assertImportValueThresholdTx` guard (built in 04-01) to derive `status`, replacing the old client-set `status: string` (now `logisticsStatus: string`). Lot creation on receiving is gated by a dual condition — `logisticsStatus === "RECEIVED" && status === "APPROVED"` — in both `create()` and `update()`, eliminating the single-field approval-bypass risk flagged in RESEARCH.md.
- Both files compile clean under `tsc --noEmit` with zero errors attributable to themselves; remaining `tsc` errors are confined to `salesOrder.controller.ts` and `importOrder.controller.ts` (expected — out of scope for this plan, targeted by 04-03).

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewire salesOrder.model.ts — status-derived stock decrement** - `8ffd58f` (feat)
2. **Task 2: Rewire importOrder.model.ts — value threshold + dual RECEIVED/APPROVED gate** - `70f21f7` (feat)

**Plan metadata:** committed separately after this SUMMARY (worktree mode — orchestrator handles final metadata commit)

_Note: Both tasks were tagged `tdd="true"` in the plan, but the plan's own action blocks specified an exact literal rewrite with no new test files and verification via grep/tsc checks only (no RED/GREEN test-file cycle was scoped into this plan) — followed as written._

## Files Created/Modified
- `apps/backend/src/models/salesOrder.model.ts` - `create()`/`update()` derive `status: OrderStatus` from `applyLotGuardsTx`; stock decrement gated on `status === "APPROVED"`; `approver` field removed
- `apps/backend/src/models/importOrder.model.ts` - `create()` derives `status: OrderStatus` from `assertImportValueThresholdTx(totalValue)`; `status` field on the data params renamed to `logisticsStatus`; lot creation dual-gated on `logisticsStatus === "RECEIVED" && status === "APPROVED"` (create) / `resolvedApprovalStatus === "APPROVED"` (update); `approver` field removed

## Decisions Made
- Followed the plan's exact action blocks verbatim for both tasks — no functional deviation from the specified rewrite shape, variable names, or comments.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Recreated missing `.env` and installed missing dependencies in worktree**
- **Found during:** Pre-task setup, before running any TypeScript/Prisma command
- **Issue:** This worktree had no `apps/backend/.env` (gitignored, not present in fresh worktree checkout) and no `node_modules` anywhere in the repo, blocking `tsc`/Prisma commands. Additionally, `pnpm install` ignored the `@prisma/client` build script by default, leaving the Prisma client ungenerated.
- **Fix:** Copied the existing `.env` content from the main repository checkout (read-only reference, not modified) into the worktree's `apps/backend/.env`; ran `pnpm install` at the worktree root; ran `npx prisma generate` explicitly to produce the Prisma client (schema already had 04-01's `OrderStatus`/`logisticsStatus` fields at this worktree's base commit, so no `db push` or dev-data clear was needed here — that was already done and merged in 04-01).
- **Files modified:** `apps/backend/.env` (untracked/gitignored, not committed), `node_modules/` (gitignored, not committed)
- **Verification:** `npx tsc --noEmit -p tsconfig.json` ran successfully afterward; grep-based acceptance criteria for both tasks all passed.
- **Committed in:** N/A (both paths are gitignored; nothing to commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking environment/tooling setup, no schema or business-logic changes)
**Impact on plan:** No scope creep — this was required to execute the plan's own verification steps in this sandboxed worktree; resulting model behavior is identical to what the plan specified.

## Issues Encountered
None beyond the environment setup documented above.

## User Setup Required

None - no external service configuration required. (Local dev database `DATABASE_URL` in `.env` already pointed at a local MySQL instance and needed no changes; this plan made no schema or database changes — schema state was already established by 04-01.)

## Known Stubs

None. Both files fully implement their new status-derivation and gating logic per the plan; no placeholder/mock data paths were introduced.

## Threat Flags

None. Both threats in this plan's own `<threat_model>` (T-04-02, T-04-02b) are the ones this plan directly mitigates — no new unaddressed surface was introduced.

## Next Phase Readiness
- Both order models now derive `status` from their guard functions and gate their respective stock effects strictly on `status === "APPROVED"`. The import-order RECEIVED-gate is a dual condition (not single-field), closing the phase's flagged highest-risk regression point.
- `salesOrder.controller.ts` and `importOrder.controller.ts` now have expected, unaddressed `tsc` errors referencing the removed `approver`/old `status`/`requiresApproval` fields — this is expected per this plan's scope boundary (`files_modified` limited to the two model files) and is 04-03's explicit target.
- No blockers for 04-03.

---
*Phase: 04-approval-workflow*
*Completed: 2026-09-16*

## Self-Check: PASSED

All claimed files found on disk (apps/backend/src/models/salesOrder.model.ts, apps/backend/src/models/importOrder.model.ts). All claimed commits found in git log (8ffd58f, 70f21f7).
