# Phase 4: Approval Workflow - Context

**Gathered:** 2026-09-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Import orders and sales orders get a real, dedicated approval status machine
(DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED) that is separate from their existing
logistics/delivery status fields. Stock is deducted exactly at the moment an order transitions to
APPROVED — not at order creation. Approving/rejecting records approver, timestamp, decision, and
(if rejected) a reason. No-self-approval and threshold-based auto-routing to PENDING_APPROVAL
already exist from Phase 3 for sales orders (credit/discount limits) — this phase extends the same
pattern to import orders (value threshold) and replaces the interim `requiresApproval` boolean /
overloaded status values with the real 5-state machine.

Multi-level (>1 tier) approval chains are out of scope (per PROJECT.md). This phase is single-tier:
one Manager/Approver decision per order.

</domain>

<decisions>
## Implementation Decisions

### Status Field Split (carried into schema design)
- **D-01:** Add a new dedicated `status` column (enum: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED,
  CANCELLED) to both `SalesOrder` and `ImportOrder`, separate from existing logistics/delivery
  fields.
- **D-02:** `ImportOrder.status` (currently overloaded with STAGING/PENDING_APPROVAL/APPROVED/
  CUSTOMS_CLEARED/RECEIVED/ISSUE/REJECTED) is renamed to a logistics-only field (e.g.
  `logisticsStatus`) retaining only STAGING/CUSTOMS_CLEARED/RECEIVED/ISSUE — approval-related
  values move to the new `status` column. Phase 3's RECEIVED-gated stock-in logic
  (`ImportOrderModel`) must be re-pointed to read/write the renamed logistics field, not the new
  approval `status` field — verify this explicitly during planning/execution so the RECEIVED gate
  keeps working.
- **D-03:** `SalesOrder.deliveryStatus` keeps its existing values (PENDING/SHIPPING/DELIVERED/
  RETURNED/DAMAGED) minus the stray APPROVED/REJECTED values, which move to the new `status`
  column. `DELIVERY_STATUS_VALUES` / `DELIVERY_PIPELINE` in `salesOrder.controller.ts` need updating
  to drop APPROVED/REJECTED.
- Existing `SalesOrder.requiresApproval` boolean and `SalesOrder.approver` / `ImportOrder.approver`
  free-text fields are replaced by the new `status` enum plus a real `approvedById` (FK to `User`),
  `approvedAt`, and `rejectionReason` field — matching APPROVAL-04's requirement to record approver,
  timestamp, decision, and reason (not just a username string).

### DRAFT Semantics
- **D-04:** DRAFT is not reachable through the current creation flow — order creation auto-routes
  directly to PENDING_APPROVAL (if the order trips the sales credit/discount threshold or the new
  import value threshold) or straight to APPROVED (stock deducts immediately in the same
  transaction) otherwise. No "save without submitting" UI/API exists and none is being added this
  phase. DRAFT remains a valid enum value reserved for future use (e.g. a multi-step order form) but
  is not produced by any current code path.

### Import Order Approval Trigger
- **D-05:** An import order requires approval (routes to PENDING_APPROVAL) when its `totalValue`
  exceeds a configurable threshold — mirrors the sales order credit/discount threshold pattern from
  Phase 3 (`applyLotGuardsTx`-style guard function). Below threshold: auto-APPROVED on create, stock
  created immediately per Phase 3's RECEIVED-gated logic (approval and the RECEIVED logistics gate
  are independent checks — both must pass for stock to actually land: order must be APPROVED AND
  logistics status RECEIVED).
- Threshold value is Claude's discretion (planner should document the chosen default clearly and
  make it easy to find/tune, e.g. a named constant or config value) — not hardcoded without a
  comment explaining the number's origin.

### CANCELLED Semantics
- **D-06:** CANCELLED is only reachable from DRAFT or PENDING_APPROVAL. An APPROVED order cannot be
  cancelled through this workflow (any correction after approval is a separate concern, out of
  scope for this phase — e.g. future return/refund flow). Because CANCELLED never applies to an
  order whose stock was already deducted, no stock-reversal logic is needed for cancellation.

### Carried Forward from Phase 3 (do not re-ask)
- No-self-approval (ENFORCE-06) already checks both `createdById` and `updatedById` against the
  approver at the existing approve/reject endpoints — reuse as-is for both models' new `status`
  transitions.
- Sales order credit-limit/discount-limit threshold checks already exist
  (`applyLotGuardsTx`/threshold logic added in Phase 3) — this phase upgrades their *output* from
  the interim `requiresApproval` boolean to setting `status = PENDING_APPROVAL`, not rewriting the
  threshold logic itself.
- Manager/Approver permission gate (Phase 2's `requirePermission` middleware) already exists at the
  approve/reject endpoints — reuse directly; APPROVAL-06 requires no new permission-checking code,
  just applying the existing check to the newly separated `status` field.
- Per-line rounding (round-half-up, 2 decimals) — unaffected by this phase, no new price/discount
  math introduced.

### Claude's Discretion
- Exact import-order value threshold number and where it lives (named constant vs. env/config).
- Exact enum/column naming for the renamed import logistics field (e.g. `logisticsStatus` vs.
  `fulfillmentStatus`) — D-02's suggestion is a starting point, not a hard requirement.
- Whether `approvedById`/`approvedAt`/`rejectionReason` live directly on `SalesOrder`/`ImportOrder`
  or in a small shared approval-audit structure — as long as APPROVAL-04's fields are queryable per
  order.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Priority
- `.planning/REQUIREMENTS.md` — APPROVAL-01 through APPROVAL-06, full requirement text
- `.planning/ROADMAP.md` §"Phase 4: Approval Workflow" — goal, success criteria, dependency on
  Phase 3
- `liquor-system-improvement-advice.md` — approval workflow requirements/acceptance criteria (see
  Phase 3 CONTEXT for the same doc's lot/enforcement sections; this phase covers its approval
  section)

### Project-Level
- `.planning/PROJECT.md` — core value (backend-first enforcement), no-self-approval constraint,
  "multi-level approval chains out of scope"
- `.planning/STATE.md` — Blockers/Concerns note flagging Phase 4 must re-verify Phase 3's
  stock-deduction wiring (order-create vs. APPROVED-transition) — directly informs D-05 above

### Prior Phase Precedent (critical — this phase builds directly on top)
- `.planning/phases/03-backend-enforcement-lot-batch-stock-control/03-CONTEXT.md` — defines the
  interim `requiresApproval` flag (D-05 in that doc) this phase upgrades, the RECEIVED-gated
  import-order stock-in logic (D-04 in that doc) that must keep working after the status-field
  split, and the existing no-self-approval check
- `.planning/phases/02-rbac-audit-logging/02-CONTEXT.md` — `requirePermission` middleware and
  audit-log mechanism this phase's approve/reject endpoints continue to use

### Code (read directly — these are the exact files this phase modifies)
- `apps/backend/prisma/schema.prisma` — `SalesOrder` (lines ~210-235), `ImportOrder` (lines
  ~99-120): current `approver`, `requiresApproval`, `status`, `deliveryStatus` fields
- `apps/backend/src/controllers/salesOrder.controller.ts` — `DELIVERY_STATUS_VALUES`,
  `DELIVERY_PIPELINE`, `approveSalesOrder`, `rejectSalesOrder` (writes to `deliveryStatus` today —
  must write to new `status` field)
- `apps/backend/src/controllers/importOrder.controller.ts` — `IMPORT_STATUS_VALUES`,
  `assertValidImportStatusTransition`, `approveImportOrder`, `rejectImportOrder`
- `apps/backend/src/models/salesOrder.model.ts` — `applyLotGuardsTx`, `createStockOutTx`,
  conditional stock deduction on `!requiresApproval`
- `apps/backend/src/models/importOrder.model.ts` — `RECEIVED`-gated stock-in logic from Phase 3

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Phase 3's `applyLotGuardsTx`-style transaction-scoped guard pattern — the new import-order value
  threshold check should follow the same shape (take `tx`, return whether approval is required)
- Phase 2's `requirePermission` middleware and audit-log utility — reuse directly for gating the
  approve/reject endpoints against the newly separated `status` field
- Existing no-self-approval check (`createdById`/`updatedById` vs. approver) at both
  `approveSalesOrder`/`approveImportOrder` — reuse verbatim

### Established Patterns
- Both order models run mutations inside `client.$transaction` with a `Client = PrismaClient |
  Prisma.TransactionClient` type — new status-transition logic slots into the same transaction
- Approve/reject today write directly to a status-like field and record `approver` as a username
  string looked up via `tx.user.findUnique` — same lookup pattern extends naturally to writing
  `approvedById` instead of a string

### Integration Points
- `apps/backend/prisma/schema.prisma` — new `status` enum + `approvedById`/`approvedAt`/
  `rejectionReason` fields on both `SalesOrder` and `ImportOrder`; rename of `ImportOrder.status`
  to a logistics-only field
- `apps/backend/src/controllers/salesOrder.controller.ts` and `importOrder.controller.ts` —
  `DELIVERY_STATUS_VALUES`/`IMPORT_STATUS_VALUES` arrays and transition-validation functions need
  updating to remove APPROVED/REJECTED and add the new dedicated status transition validator
- `apps/backend/prisma/seed.ts` — seed rows currently set `ImportOrder.status` to logistics values
  (STAGING/PENDING_APPROVAL/APPROVED/CUSTOMS_CLEARED/RECEIVED/ISSUE) and `SalesOrder.deliveryStatus`
  including stray APPROVED/REJECTED — will need updating for the new split fields, consistent with
  Phase 3's seed migration precedent (03-10-PLAN.md)

</code_context>

<specifics>
## Specific Ideas

No additional specific visual/UX references — this is a backend-only phase (no new UI screens; the
existing approve/reject actions in the sales/import order UI just need to reflect the new status
values and rejection-reason field).

</specifics>

<deferred>
## Deferred Ideas

- Real DRAFT/"save without submitting" step with an explicit submit action — noted as a possible
  future UX improvement but not built this phase (D-04)
- Cancelling an already-APPROVED order with stock reversal — deferred; treated as a future
  return/refund concern, not part of this phase's CANCELLED semantics (D-06)
- Multi-level (>1 tier) approval chains — out of scope for the whole milestone per PROJECT.md, not
  just this phase

</deferred>

---

*Phase: 04-approval-workflow*
*Context gathered: 2026-09-16*
