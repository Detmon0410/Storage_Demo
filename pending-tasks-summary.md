# Pending Tasks & Open Questions

_As of 2026-09-14, after Phase 2 (RBAC & Audit Logging) completion._

## Status

- Phase 1 (Authentication): Done
- Phase 2 (RBAC & Audit Logging): **Done** — all 14 plans, both UI checkpoints approved this session
- Phase 7 (Company Profile & Permit Deadlines): Done
- Phase 3 (Backend Enforcement & Lot/Batch Stock Control): Not started, not yet planned
- Phase 4 (Approval Workflow): Not started, not yet planned
- Phase 5 (Liquor Tax & Compliance Data): Not started, not yet planned
- Phase 6 (Documents & Reporting): Not started, not yet planned
- Phase 8 (Import Documents, Quotation & Billing): Not started, not yet planned (added via `spec-gap-closure-plan.md`)

Next command: `/gsd-plan-phase 3`

## Open Cleanup Items (from this session)

- **Stray admin account**: user `test` (id 2343, SYSTEM_ADMIN role) was created during manual checkpoint testing on 2026-09-14. Not deactivated — decide whether to deactivate/remove it.
- **Test data left in DB**: a handful of demo Category/Supplier rows (`DEMO_CAT_1`/deleted, `DEMO_SUP_1`) and a `verify_test_user` account (deactivated) were created to generate audit-log variety for review. Harmless but should be cleaned before any real usage/demo.

## Decisions Made This Session

- Approver field on Import Order stays free-text for now — Phase 4 will replace it with a real `approvedBy`/`approvedAt` tied to the actual approve/reject action; changing it now would be throwaway work.
- Customs Entry No. stays free-text — it's an externally-issued number from customs, not something to select from a list.
- Audit Log page pagination: added (was previously unbounded), page size set to 15 rows.

## Open Question — Not Yet Decided

- **Import Order number (`orderNo`)**: currently must be typed manually (required field, enforced unique in DB, no auto-generation). Was asked about but no decision made on whether to add auto-numbering (e.g. `IMP-2026-0001` sequential format).

## Carried-Forward Blockers/Concerns (from STATE.md, pre-dating this session)

These block planning for Phase 4/6/8 and should be resolved before those phases are planned in detail:

- **Permit lifecycle states**: beyond the computed notification tiers (120/90/60/30-day + expired), the spec implies additional states like "Renewing" or "Suspended." Undecided whether these are manually set or computed, and who (post-RBAC) can set them.
- **Approval workflow role mapping**: the source spec describes a Staff → Supervisor → Manager approval chain; needs to be mapped onto the 6 RBAC roles already built in Phase 2 before Phase 4 can be planned.
- **Document versioning granularity**: unclear how granular version tracking needs to be for generated documents (Phase 6/8).
- **Spec §12 integration layer scope**: whether Drive/accounting/banking/e-commerce/API integrations are in scope at all for this milestone, or entirely out of scope (current lean, from `spec-gap-closure-plan.md`, is record-keeping only — no live integrations).
- **Phase 4 must re-verify Phase 3's stock-deduction wiring**: research flagged that Phase 3 will initially deduct stock at order-create time, and Phase 4 must explicitly move that trigger to the APPROVED transition — not treat it as new isolated work.

## Reference

- Full phase breakdown: `.planning/ROADMAP.md`
- Requirements traceability: `.planning/REQUIREMENTS.md`
- Spec gap analysis (source of Phases 7-8): `spec-gap-closure-plan.md`
