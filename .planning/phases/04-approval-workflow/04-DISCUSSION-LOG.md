# Phase 4: Approval Workflow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 04-approval-workflow
**Areas discussed:** Status field split, DRAFT semantics, Import order approval trigger, CANCELLED semantics

---

## Status Field Split

| Option | Description | Selected |
|--------|-------------|----------|
| Separate column, both models | New `status` enum on both models; rename ImportOrder.status to logistics-only field; strip APPROVED/REJECTED from SalesOrder.deliveryStatus | ✓ |
| Separate column, keep old field untouched | New `status` column added, but old overloaded fields left as-is with dead APPROVED/REJECTED values | |
| Let Claude decide during planning | Defer schema approach entirely to planner | |

**User's choice:** Separate column, both models (recommended option)
**Notes:** Confirmed both `ImportOrder.status` (STAGING/PENDING_APPROVAL/APPROVED/CUSTOMS_CLEARED/RECEIVED/ISSUE/REJECTED) and `SalesOrder.deliveryStatus` (PENDING/SHIPPING/DELIVERED/.../APPROVED/REJECTED) currently conflate approval with logistics — verified directly in `importOrder.controller.ts` and `salesOrder.controller.ts`.

---

## DRAFT Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Skip DRAFT at creation | Order creation auto-routes to PENDING_APPROVAL or APPROVED directly; DRAFT reserved but unreachable | ✓ |
| Real DRAFT step, explicit submit | New UI/API "submit for approval" action; orders editable while DRAFT | |

**User's choice:** Skip DRAFT at creation (recommended option)
**Notes:** Matches current UI — no "save draft" step exists in sales/import order forms today.

---

## Import Order Approval Trigger

| Option | Description | Selected |
|--------|-------------|----------|
| Value threshold | totalValue over a configurable threshold routes to PENDING_APPROVAL | ✓ |
| Always requires approval | Every import order needs Manager sign-off, no auto-approve | |
| Creator's discretion | Manual checkbox at creation | |

**User's choice:** Value threshold (recommended option)
**Follow-up:** Asked whether to specify an exact threshold number — user chose "Claude's discretion" (planner picks and documents a reasonable default, easy to tune later).

---

## CANCELLED Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| DRAFT/PENDING_APPROVAL only, no stock impact | Simple terminal transition before stock is ever deducted | ✓ |
| Any non-terminal state, restores stock if APPROVED | APPROVED orders cancellable too, with stock reversal | |

**User's choice:** DRAFT/PENDING_APPROVAL only, no stock impact (recommended option)

---

## Claude's Discretion

- Exact import-order value threshold number and where it lives (constant vs. config)
- Exact naming for the renamed import logistics status field
- Whether approval audit fields (approvedById/approvedAt/rejectionReason) live directly on the order models or a shared structure

## Deferred Ideas

- Real DRAFT/explicit-submit step with editable pre-submission state
- Stock-reversing cancellation of an already-APPROVED order (future return/refund concern)
