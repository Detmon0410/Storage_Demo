---
phase: 04
slug: approval-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-09-16
---

# Phase 04 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest [VERIFIED: apps/backend/package.json `"test": "vitest run"`, apps/backend/vitest.config.ts] |
| **Config file** | `apps/backend/vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/order.noSelfApproval.test.ts tests/salesOrder.creditLimit.test.ts tests/salesOrder.discountLimit.test.ts` |
| **Full suite command** | `npm test` (from `apps/backend`) → `vitest run` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched test files>`
- **After every plan wave:** Run `npm test` (from `apps/backend`) — full suite, since this phase touches shared field names referenced by many unrelated-looking test files (audit, rbac, license-block tests all create sales/import orders as fixtures)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | APPROVAL-05 | T-04-01 | New threshold guard rejects import order over value threshold, routes to PENDING_APPROVAL | integration | `npx vitest run tests/importOrder.valueThreshold.test.ts` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 0 | APPROVAL-04 | T-04-03 | Approve/reject records approvedById/approvedAt/rejectionReason | integration | `npx vitest run tests/order.noSelfApproval.test.ts` | ✅ existing (extend) | ⬜ pending |
| 04-02-01 | 02 | 1 | APPROVAL-01, APPROVAL-02, APPROVAL-03 | T-04-02 | 5-value status enum; non-APPROVED has no stock effect; stock decremented exactly at APPROVED | integration | `npx vitest run tests/salesOrder.creditLimit.test.ts tests/salesOrder.discountLimit.test.ts` | ✅ existing (rewrite) | ⬜ pending |
| 04-03-01 | 03 | 1 | APPROVAL-06 | T-04-01 | Manager/Approver can approve/reject; non-holder rejected server-side | integration | `npx vitest run tests/rbac.enforcement.writes.orders.test.ts` | ✅ existing (verify not asserting removed fields) | ⬜ pending |
| 04-04-01 | 04 | 2 | ALL | T-04-01/02/03 | Full regression across renamed/added fields | full suite | `npm test` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/importOrder.valueThreshold.test.ts` — new test covering APPROVAL-05 for import orders (mirror `creditDiscountGate.test.ts` pattern)
- [ ] Extend `tests/order.noSelfApproval.test.ts` — add assertions for `approvedById`/`approvedAt`/`rejectionReason` fields (APPROVAL-04)
- [ ] Extend `tests/salesOrder.creditLimit.test.ts` and `tests/salesOrder.discountLimit.test.ts` — update `requiresApproval` assertions to `status === "PENDING_APPROVAL"`/`"APPROVED"`, add explicit `InventoryStock.quantityOnHand` check before/after `/approve` (APPROVAL-03)
- [ ] Audit `apps/backend/tests/` for literal references to `requiresApproval`, `deliveryStatus === "APPROVED"/"REJECTED"`, or `ImportOrder.status` used with approval semantics (at minimum: `audit.crud.orders.test.ts`, `rbac.enforcement.writes.orders.test.ts`, `creditDiscountGate.test.ts`)

---

## Manual-Only Verifications

*All phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
