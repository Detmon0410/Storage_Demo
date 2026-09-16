# Deferred Items — Phase 04 (approval-workflow)

## From 04-05: Out-of-scope pre-existing test failures (field-rename fallout)

**Found during:** 04-05 full-suite sanity check (`npx vitest run`, run after completing all 3
in-scope tasks; not part of 04-05's own verification requirement, done as a scope check).

**Issue:** 8 test files fail (36 tests) with the same class of failure 04-05 was scoped to fix
(stale `status`/`deliveryStatus`/`requiresApproval` assertions and fixture payloads against the
post-04-01/04-02/04-03 schema and controllers). These files are NOT in 04-05's `files_modified`
list and were not assigned to any other phase-04 plan's `files_modified` either:

- `tests/importOrder.enforce05.test.ts`
- `tests/importOrder.inputValidation.test.ts`
- `tests/importOrder.license-block.test.ts`
- `tests/importOrder.receivingGate.test.ts`
- `tests/importOrder.receivingLots.test.ts`
- `tests/models.txClient.test.ts`
- `tests/order.genericUpdateRestriction.test.ts`
- `tests/salesOrder.inputValidation.test.ts`

Representative failure modes observed:
- Import-order fixtures still POST `status: "..."` instead of `logisticsStatus: "..."` (create
  now rejects/ignores `status` per 04-03 controller rewrite).
- Assertions on `body.deliveryStatus === "APPROVED"/"REJECTED"` for sales orders (same Pitfall 1
  bug 04-05 fixed in `order.noSelfApproval.test.ts` — `deliveryStatus` stays unchanged per D-03,
  the new `status` field is what transitions).
- Assertions expecting the old error message "Use the dedicated approve/reject endpoint" for a
  client-submitted `status`/`deliveryStatus` of APPROVED/REJECTED, which no longer matches the
  04-03 controllers' actual validation-transition error message shape.

**Why not fixed here:** Explicitly out of 04-05's scope boundary — `files_modified` in the
04-05-PLAN.md frontmatter lists exactly 5 files, all of which are now fixed and passing. Fixing
these 8 additional files would be scope creep beyond what this plan's tasks, acceptance criteria,
and `<verification>` section define.

**Relevance to phase gate:** `04-07-PLAN.md`'s `must_haves.truths` includes "The full backend
test suite passes with zero regressions" but `04-07-PLAN.md`'s own `files_modified` is `[]`
(verification-only plan, no fix tasks). As currently scoped, no plan in this phase fixes these 8
files, so 04-07's full-suite-passes gate will fail unless a plan is added/amended before 04-07
runs. Flagged here and in 04-05-SUMMARY.md's "Next Phase Readiness" section for the orchestrator's
attention.

**Status:** Deferred, unresolved.
