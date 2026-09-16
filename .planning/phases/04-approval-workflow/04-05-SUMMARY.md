---
phase: 04-approval-workflow
plan: 05
subsystem: testing
tags: [vitest, supertest, prisma, approval-workflow, regression-fix]

# Dependency graph
requires:
  - phase: 04-approval-workflow
    plan: 03
    provides: "salesOrder.controller.ts / importOrder.controller.ts real ORDER_STATUS_VALUES machine, approvedById/approvedAt/rejectionReason as real columns, logisticsStatus replacing the overloaded status field on import-order create"
  - phase: 04-approval-workflow
    plan: 04
    provides: "seed data migrated off requiresApproval/approver"
provides:
  - "apps/backend/tests/order.noSelfApproval.test.ts: all 5 cases assert status/approvedById/approvedAt/rejectionReason instead of the removed deliveryStatus-as-approval-signal and status field"
  - "apps/backend/tests/salesOrder.creditLimit.test.ts and salesOrder.discountLimit.test.ts: all cases assert status (PENDING_APPROVAL/APPROVED) instead of the removed requiresApproval boolean"
  - "apps/backend/tests/audit.crud.orders.test.ts and rbac.enforcement.writes.orders.test.ts: import-order create fixtures use logisticsStatus instead of the removed overloaded status field"
affects: [04-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Test assertions on approval outcome now target the real status enum / approvedById / approvedAt / rejectionReason columns rather than the removed requiresApproval boolean or deliveryStatus-as-approval-signal, matching RESEARCH.md Pitfall 1"

key-files:
  created: []
  modified:
    - apps/backend/tests/order.noSelfApproval.test.ts
    - apps/backend/tests/salesOrder.creditLimit.test.ts
    - apps/backend/tests/salesOrder.discountLimit.test.ts
    - apps/backend/tests/audit.crud.orders.test.ts
    - apps/backend/tests/rbac.enforcement.writes.orders.test.ts

key-decisions:
  - "createTestUserWithRoles returns {user, username, password} not {id}, so approver.id in the plan's action text was adjusted to approver.user.id for the new approvedById assertions"
  - "Also updated stale it() description strings still mentioning requiresApproval/deliveryStatus in salesOrder.creditLimit.test.ts and salesOrder.discountLimit.test.ts, and a second status: \"STAGING\" import-order fixture in audit.crud.orders.test.ts (line 234) not explicitly called out in the plan's action text, to fully satisfy the plan's own zero-match grep acceptance criteria"

requirements-completed: [APPROVAL-02, APPROVAL-03, APPROVAL-04, APPROVAL-06]

# Metrics
duration: ~35min
completed: 2026-09-16
---

# Phase 4 Plan 5: Test Suite Field-Rename Sweep Summary

**Rewrote all assertions/fixtures in 5 existing backend test files that referenced the removed `requiresApproval`/`approver` fields or the old overloaded `ImportOrder.status`, so they now assert against the real post-04-03 `status`/`approvedById`/`approvedAt`/`rejectionReason` columns and `logisticsStatus` field — all 18 in-scope tests pass.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-09-16T02:50:00Z (approx, includes worktree env setup)
- **Completed:** 2026-09-16T03:28:28Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- `order.noSelfApproval.test.ts`: replaced the RESEARCH.md Pitfall 1 bug (asserting `deliveryStatus === "APPROVED"/"REJECTED"` for sales orders, which never changes per D-03) with `status`/`approvedById`/`approvedAt`/`rejectionReason` assertions across all 5 no-self-approval test cases; renamed the import-order create fixture's `status` field to `logisticsStatus`; updated the direct-Prisma historical-data fixture (`createdById: null` case) from the old overloaded `status: "PENDING"` to `logisticsStatus: "STAGING"`, since `"PENDING"` is not a valid value in either the new `LOGISTICS_STATUS_VALUES` or `ORDER_STATUS_VALUES` enums.
- `salesOrder.creditLimit.test.ts` and `salesOrder.discountLimit.test.ts`: replaced all `requiresApproval` boolean assertions with `status` enum assertions (`"PENDING_APPROVAL"` / `"APPROVED"`) across all 6 combined test cases (over-limit soft-block, approve-and-decrement, under-limit immediate-decrement in each file); stock-decrement and stock-transaction-count assertions left unchanged since they already correctly verify APPROVAL-03.
- `audit.crud.orders.test.ts` and `rbac.enforcement.writes.orders.test.ts`: renamed import-order create request bodies from `status: "RECEIVED"`/`status: "STAGING"` to `logisticsStatus: "RECEIVED"`/`logisticsStatus: "STAGING"` — no assertion logic changed since neither file asserts on the approval `status` value itself.
- Full targeted verification run (`tests/order.noSelfApproval.test.ts tests/salesOrder.creditLimit.test.ts tests/salesOrder.discountLimit.test.ts tests/audit.crud.orders.test.ts tests/rbac.enforcement.writes.orders.test.ts`) passes: 5 files, 18/18 tests.
- All plan acceptance-criteria `grep` checks pass, including zero remaining matches for `requiresApproval`/`.approver` in the 5 in-scope files and zero remaining matches for the old `status: "RECEIVED"`/`status: "STAGING"` import-order payload shape.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite order.noSelfApproval.test.ts assertions** - `2cbfcfe` (test)
2. **Task 2: Rewrite salesOrder.creditLimit.test.ts and salesOrder.discountLimit.test.ts** - `cfe8589` (test)
3. **Task 3: Fix import-order create payloads in audit.crud.orders.test.ts and rbac.enforcement.writes.orders.test.ts** - `291923e` (test)

**Plan metadata:** committed separately after this SUMMARY (worktree mode — orchestrator handles final metadata commit)

## Files Created/Modified

- `apps/backend/tests/order.noSelfApproval.test.ts` - All 5 approve/reject no-self-approval cases now assert `status`/`approvedById`/`approvedAt`/`rejectionReason`; import-order fixtures use `logisticsStatus`
- `apps/backend/tests/salesOrder.creditLimit.test.ts` - All 3 credit-limit cases assert `status` (`PENDING_APPROVAL`/`APPROVED`) instead of `requiresApproval`
- `apps/backend/tests/salesOrder.discountLimit.test.ts` - All 3 discount-limit cases assert `status` (`PENDING_APPROVAL`/`APPROVED`) instead of `requiresApproval`
- `apps/backend/tests/audit.crud.orders.test.ts` - Both import-order create fixtures use `logisticsStatus` instead of `status`
- `apps/backend/tests/rbac.enforcement.writes.orders.test.ts` - Import-order create fixture inside `it.each` block uses `logisticsStatus` instead of `status`

## Decisions Made

- `approver.id` in the plan's Task 1 action text was adjusted to `approver.user.id`: `createTestUserWithRoles` (in `tests/fixtures/testUser.ts`) returns `{ user, username, password }`, not a flat object with an `id` property, so the new `approvedById` assertions reference `approver.user.id` to match the actual fixture shape.
- Beyond the plan's literal line-numbered action text, also fixed two occurrences the plan's grep-based acceptance criteria required but didn't individually call out: a second `status: "STAGING"` import-order fixture at `audit.crud.orders.test.ts:234` (a different test case than the one the plan's action text named at line 134), and the stale `requiresApproval`-referencing text inside two `it(...)` description strings in `salesOrder.creditLimit.test.ts`/`salesOrder.discountLimit.test.ts`. Both were required to make the plan's own acceptance-criteria grep commands (which check for zero matches, not just the specific lines called out in `<action>`) actually pass.

## Deviations from Plan

None requiring Rule 1-4 classification — all changes were within the plan's own scope and acceptance criteria (see "Decisions Made" above for two minor gap-fills needed to satisfy the plan's own grep-based acceptance criteria, which is bookkeeping/documentation-completeness rather than a functional deviation).

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Recreated missing `.env` and installed missing dependencies in worktree**
- **Found during:** Pre-task setup, before running any vitest/Prisma command
- **Issue:** This worktree had no `apps/backend/.env` (gitignored) and no `node_modules` anywhere in the repo, blocking `vitest`/Prisma commands — same pattern as prior 04-03/04-04 executors in fresh worktrees.
- **Fix:** Copied `.env` content from the main repository checkout (read-only reference, not modified) into the worktree's `apps/backend/.env`; ran `pnpm install` at the worktree root; ran `npx prisma generate` explicitly.
- **Files modified:** `apps/backend/.env` (untracked/gitignored, not committed), `node_modules/` (gitignored, not committed)
- **Verification:** `npx vitest run` for all in-scope test files succeeded afterward.
- **Committed in:** N/A (both paths are gitignored; nothing to commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking environment/tooling setup, no test-logic changes)
**Impact on plan:** No scope creep — the environment fix was required to execute the plan's own verification steps in this sandboxed worktree.

## Issues Encountered

None beyond the environment setup documented above.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. All changes are test-file assertion/fixture updates; no production code, mock data paths, or placeholder rendering introduced.

## Threat Flags

None. This plan touches only test files; no new production trust-boundary surface introduced. The plan's own `<threat_model>` (T-04-06, repudiation via stale test assertions) is the mitigation target, and it is closed by this plan's changes.

## Next Phase Readiness

- All 5 files in this plan's scope now pass in full (18/18 tests) against the real post-04-03 schema/controller fields.
- **Flag for 04-07 (final phase-gate verification):** a full-suite sanity run (`npx vitest run`, not part of this plan's own verification requirement, done as an informational check beyond scope) found 8 additional test files (36 tests) failing with the same class of field-rename fallout this plan was scoped to fix, but NOT included in 04-05's `files_modified` list nor assigned to any other phase-04 plan's `files_modified`:
  - `tests/importOrder.enforce05.test.ts`
  - `tests/importOrder.inputValidation.test.ts`
  - `tests/importOrder.license-block.test.ts`
  - `tests/importOrder.receivingGate.test.ts`
  - `tests/importOrder.receivingLots.test.ts`
  - `tests/models.txClient.test.ts`
  - `tests/order.genericUpdateRestriction.test.ts`
  - `tests/salesOrder.inputValidation.test.ts`

  `04-07-PLAN.md`'s `must_haves.truths` requires "The full backend test suite passes with zero regressions" but `04-07-PLAN.md`'s own `files_modified` is `[]` (verification-only, no fix tasks) — as currently scoped, no plan in this phase fixes these 8 files. Logged in detail (with representative failure modes) in `.planning/phases/04-approval-workflow/deferred-items.md`. This was deliberately left unfixed here per 04-05's own scope boundary (`files_modified` lists exactly 5 files) — fixing 8 more files would be scope creep beyond this plan's defined tasks/acceptance criteria.
- No blockers for 04-06 (frontend, concurrent wave, no file overlap).

---
*Phase: 04-approval-workflow*
*Completed: 2026-09-16*

## Self-Check: PASSED

All 5 claimed modified test files found on disk (order.noSelfApproval.test.ts, salesOrder.creditLimit.test.ts, salesOrder.discountLimit.test.ts, audit.crud.orders.test.ts, rbac.enforcement.writes.orders.test.ts), plus deferred-items.md. All 3 claimed task commits found in git log (2cbfcfe, cfe8589, 291923e).
