---
phase: 7
slug: company-profile-permit-deadlines
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-09-11
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^2.1.8 + Supertest ^7.0.0 (backend); `tsc --noEmit` type-check gate (frontend, no test runner configured for pages yet) |
| **Config file** | none found — no `vitest.config.ts` in `apps/backend`; tests run via `"test": "vitest run"` relying on Vitest defaults with discovery root `apps/backend/tests/` |
| **Quick run command** | `cd apps/backend && npx vitest run tests/<file>.test.ts` (backend); `cd apps/frontend && npx tsc --noEmit` (frontend) |
| **Full suite command** | `cd apps/backend && npm test` |
| **Estimated runtime** | ~15-30 seconds (backend suite, integration tests against live MySQL) |

---

## Sampling Rate

- **After every task commit:** Run the task's `<automated>` command (specific new/changed test file, or `tsc --noEmit`)
- **After every plan wave:** Run `cd apps/backend && npm test` (full backend suite) and `cd apps/frontend && npx tsc --noEmit`
- **Before `/gsd-verify-work`:** Full backend suite must be green; frontend type-check must be clean
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | COMPANY-01, PERMIT-01 | T-07-01 | Schema pushed live; License FKs nullable, daysRemaining/status columns dropped | integration | `cd apps/backend && npx prisma validate && npx prisma db push --accept-data-loss` | N/A (schema op) | ⬜ pending |
| 07-01-02 | 01 | 1 | PERMIT-02 | — | computePermitStatus boundary-correct at 120/90/60/30/0 days | unit | `npx vitest run tests/permitStatus.test.ts` | ❌ W0 → created this task | ⬜ pending |
| 07-01-03 | 01 | 1 | COMPANY-01 | T-07-01, T-07-02, T-07-03 | Company singleton — GET/PUT only, upsert pinned to id=1 | integration | `npx vitest run tests/company.test.ts` | ❌ W0 → created this task | ⬜ pending |
| 07-02-01 | 02 | 2 | PERMIT-01, PERMIT-02 | T-07-04, T-07-05 | daysRemaining/status never accepted from input; companyId/productId accepted | integration | `npx vitest run tests/license.test.ts` | ❌ W0 → created this task | ⬜ pending |
| 07-02-02 | 02 | 2 | PERMIT-01 | — | Seed links licenses to seeded Company | integration | `cd apps/backend && npm run db:setup` | N/A (seed op) | ⬜ pending |
| 07-03-01 | 03 | 2 | PERMIT-04 | T-07-06, T-07-07 | assertProductsNotBlockedTx throws HttpError(400) for EXPIRED-linked productIds | unit/integration | `npx vitest run tests/salesOrder.license-block.test.ts tests/importOrder.license-block.test.ts` | ❌ W0 → created this task | ⬜ pending |
| 07-03-02 | 03 | 2 | PERMIT-04 | T-07-06, T-07-07 | SalesOrder create/update-with-items reject expired-permit products; no partial write | integration | `npx vitest run tests/salesOrder.license-block.test.ts` | ❌ W0 → created this task | ⬜ pending |
| 07-03-03 | 03 | 2 | PERMIT-04 | T-07-06, T-07-07 | ImportOrder create/update-with-items reject expired-permit products; no partial write | integration | `npx vitest run tests/importOrder.license-block.test.ts` | ❌ W0 → created this task | ⬜ pending |
| 07-04-01 | 04 | 3 | COMPANY-01, PERMIT-01, PERMIT-02 | — | Type contracts compile; companyApi is get/save only (no createResourceApi) | type-check | `cd apps/frontend && npx tsc --noEmit` | existing tsconfig | ⬜ pending |
| 07-04-02 | 04 | 3 | PERMIT-03, PERMIT-04 | — | i18n key parity between en.ts/ja.ts; TranslationSchema satisfied | type-check | `cd apps/frontend && npx tsc --noEmit` | existing tsconfig | ⬜ pending |
| 07-05-01 | 05 | 4 | COMPANY-01 | T-07-10 | CompanyPage renders singleton form only (no create/delete affordance) | type-check | `cd apps/frontend && npx tsc --noEmit` | existing tsconfig | ⬜ pending |
| 07-05-02 | 05 | 4 | COMPANY-01 | — | /company route + nav registered | type-check | `cd apps/frontend && npx tsc --noEmit` | existing tsconfig | ⬜ pending |
| 07-05-03 | 05 | 4 | COMPANY-01 | — | Visual/functional confirmation of Company page | manual | N/A — checkpoint:human-verify | N/A | ⬜ pending |
| 07-06-01 | 06 | 4 | PERMIT-01, PERMIT-02 | T-07-11 | License form sends companyId/productId only, no daysRemaining/status | type-check | `cd apps/frontend && npx tsc --noEmit` | existing tsconfig | ⬜ pending |
| 07-06-02 | 06 | 4 | PERMIT-01, PERMIT-02 | — | Visual/functional confirmation of License form changes | manual | N/A — checkpoint:human-verify | N/A | ⬜ pending |
| 07-07-01 | 07 | 4 | PERMIT-03 | T-07-12 | Dashboard 5-bucket permit grouping computed client-side | type-check | `cd apps/frontend && npx tsc --noEmit` | existing tsconfig | ⬜ pending |
| 07-07-02 | 07 | 4 | PERMIT-03 | — | Visual/functional confirmation of dashboard bucket tiles | manual | N/A — checkpoint:human-verify | N/A | ⬜ pending |
| 07-08-01 | 08 | 4 | PERMIT-04 | T-07-13 | SalesOrdersPage blocker extended with expired-permit check | type-check | `cd apps/frontend && npx tsc --noEmit` | existing tsconfig | ⬜ pending |
| 07-08-02 | 08 | 4 | PERMIT-04 | T-07-13 | ImportOrdersPage blocker introduced with expired-permit check | type-check | `cd apps/frontend && npx tsc --noEmit` | existing tsconfig | ⬜ pending |
| 07-08-03 | 08 | 4 | PERMIT-04 | — | Visual/functional confirmation of order-blocking UI | manual | N/A — checkpoint:human-verify | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/backend/tests/permitStatus.test.ts` — stubs for PERMIT-02 (created inside Plan 07-01, Task 2)
- [ ] `apps/backend/tests/company.test.ts` — stubs for COMPANY-01 (created inside Plan 07-01, Task 3)
- [ ] `apps/backend/tests/license.test.ts` — stubs for PERMIT-01/PERMIT-02 (created inside Plan 07-02, Task 1; no prior License test coverage existed at all before this phase)
- [ ] `apps/backend/tests/salesOrder.license-block.test.ts` — stubs for PERMIT-04 (created inside Plan 07-03, Task 2)
- [ ] `apps/backend/tests/importOrder.license-block.test.ts` — stubs for PERMIT-04 (created inside Plan 07-03, Task 3)

No new test framework/infra install needed — Vitest/Supertest already configured and working (per `apps/backend/tests/auth.*.test.ts`). Wave 0 gaps are closed inline within Plans 07-01/07-02/07-03 rather than as a separate upfront plan, since each new test file is scoped to the same plan that introduces the behavior it tests.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Company Profile page visual/interaction correctness | COMPANY-01 | UI layout, empty-state copy, toast feedback — not meaningfully assertable via `tsc --noEmit` alone | See Plan 07-05's `checkpoint:human-verify` task |
| License form Company/Product select UX, computed-badge display | PERMIT-01, PERMIT-02 | Visual badge tone/label correctness across the 6-tier system | See Plan 07-06's `checkpoint:human-verify` task |
| Dashboard 5-bucket tile layout, ordering, color escalation | PERMIT-03 | Visual left-to-right calm-to-alarming ordering and tone correctness | See Plan 07-07's `checkpoint:human-verify` task |
| Order-blocking UI message/disable-state across both order forms | PERMIT-04 | Visual confirmation that the non-authoritative frontend block matches the authoritative backend decision | See Plan 07-08's `checkpoint:human-verify` task |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (checkpoint:human-verify tasks are explicitly manual per the phase's checkpoint contract, not a Nyquist gap)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (each `checkpoint:human-verify` task is immediately preceded by 1-2 automated `auto` tasks in the same plan)
- [x] Wave 0 covers all MISSING references (5 new test files, each scoped to the plan introducing its behavior)
- [x] No watch-mode flags (all commands use `vitest run`, not `vitest watch`)
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
