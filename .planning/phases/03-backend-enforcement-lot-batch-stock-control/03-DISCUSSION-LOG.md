# Phase 3: Backend Enforcement & Lot/Batch Stock Control - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-15
**Phase:** 03-backend-enforcement-lot-batch-stock-control
**Areas discussed:** Lot selection & sourcing, Import receiving/lot-creation timing, Credit & discount limit enforcement, Stock-adjustment reason codes

---

## Lot Selection & Sourcing

| Option | Description | Selected |
|--------|-------------|----------|
| FK + FIFO-suggested, overridable | Real FK to InventoryStock, auto-suggest oldest lot by receivedDate, staff can override | ✓ |
| FK + FIFO-forced, no override | Always sells oldest lot first, no discretion | |
| FK, manual pick only | No FIFO logic, staff always chooses | |

**User's choice:** FK + FIFO-suggested, overridable (recommended option)
**Notes:** User asked to follow the PDF/source docs' layout directly rather than deep back-and-forth; this and the following areas were presented as single-pass recommended-default confirmations.

---

## Import Receiving / Lot-Creation Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Gate to status = RECEIVED | Lots/stock-IN only fire on RECEIVED transition, not order creation | ✓ |
| Keep current behavior | Stock-IN fires unconditionally at order creation (today's bug) | |

**User's choice:** Gate to status = RECEIVED (recommended option)
**Notes:** Surfaced as a gap not covered by either source doc — found during codebase scout
(`ImportOrderModel.create()` fires stock-IN regardless of status).

---

## Credit & Discount Limit Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal PENDING flag, Phase 4 upgrades | Reuse Phase 2's interim-endpoint precedent; blocks stock deduction until Manager/Approver approves | ✓ |
| Hard reject, no override path | Order over limit is simply rejected, no path forward until Phase 4 | |

**User's choice:** Minimal PENDING flag, Phase 4 upgrades (recommended option)

---

## Stock-Adjustment Reason Codes

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed list + free-text note | DAMAGE / THEFT / RECOUNT / EXPIRY / CORRECTION / OTHER | ✓ |
| Free text only | No fixed list | |

**User's choice:** Fixed list + free-text note (recommended option)

---

## Claude's Discretion

- Exact schema shape of the interim "requires approval" flag (boolean vs. enum)
- Whether import receiving captures an explicit lot/batch number or auto-generates from orderNo
- HTTP verb/endpoint shape for the stock-adjustment action

## Deferred Ideas

- Full approval status machine — Phase 4
- Landed cost allocation — Phase 5 (already resolved: by value)
- Multi-branch/warehouse — deferred past this milestone (Phase 7 scope note)
- Document generation — Phase 6
