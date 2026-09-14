# Deferred Items — Phase 02

## Full-suite test flakiness (pre-existing, out of scope for 02-06)

**Found during:** Plan 02-06 full-suite verification (`pnpm exec vitest run`)

**Symptom:** Different unrelated test files fail intermittently across repeated full-suite runs
(observed: `salesOrder.license-block.test.ts` failing with 401 instead of expected 400/201 in one
run; `auth.hashing.test.ts` failing a `RefreshTokenModel.findValid` assertion in another run).
Both files pass consistently when run in isolation (`vitest run tests/<file>.test.ts`).

**Root cause (suspected):** Cross-file test pollution/timing when the full suite runs — likely
IP-based rate-limiting state or DB timing races shared across concurrently-executed test files,
unrelated to any code path touched by plan 02-06 (which only added `requirePermission` to GET
routes on product/inventoryStock/importOrder/salesOrder/stockTransaction and added one new test
file).

**Action taken:** Not fixed — out of scope per the deviation-rules scope boundary (only auto-fix
issues directly caused by the current task's changes). Verified plan 02-06's own target test
(`rbac.enforcement.reads.batchB.test.ts`) passes cleanly, and that the two flaky files pass in
isolation, confirming plan 02-06 did not introduce a regression.

**Status:** Deferred — logged for phase-level test-infrastructure follow-up (e.g. serializing
rate-limit-sensitive tests or resetting rate-limiter state between test files).
