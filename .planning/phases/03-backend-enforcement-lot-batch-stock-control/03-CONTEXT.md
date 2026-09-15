# Phase 3: Backend Enforcement & Lot/Batch Stock Control - Context

**Gathered:** 2026-09-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Invalid business actions (expired/missing license, overselling a lot, uncontrolled credit/discount) are
rejected by the backend regardless of caller, and `InventoryStock` (lot/batch) becomes the real source
of truth for quantity — not just `Product.stockQty`. This phase delivers: a real FK from sales order
lines to a specific inventory lot, lot-level quantity checks and decrements wired into sales order
create/update/delete, import-order receiving that actually creates/updates `InventoryStock` lots
(gated to when the order is RECEIVED, not at order creation), credit-limit and discount-limit checks
on sales orders with a minimal interim "requires approval" flag ahead of Phase 4's real status
machine, and an audited stock-adjustment path with reason codes replacing direct manual
`InventoryStock.quantityOnHand` edits.

Full approval status machine (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED) is Phase 4 — not
this phase. This phase only adds a minimal boolean/flag-style "needs approval" gate on top of the
existing Phase 2 approve/reject endpoints, following the same interim-then-upgrade pattern Phase 2
used for import/sales order approve/reject ahead of the full workflow.

</domain>

<decisions>
## Implementation Decisions

### Lot Selection & Sourcing
- **D-01:** `SalesOrderItem.lotBatch` (currently a free-text string, no relational integrity) becomes
  a real FK to `InventoryStock` (`inventoryStockId`). Creating/updating a sales order validates the
  selected lot has sufficient `quantityOnHand` and decrements it in the same transaction (mirrors the
  existing `Product.stockQty` pattern in `stockTransaction.model.ts`, applied one level down).
- **D-02:** The backend auto-suggests the oldest available lot for a product (FIFO by `receivedDate`)
  when a sales order line is created, but sales staff can override to a different lot if more than one
  exists for that product. Not FIFO-forced.
- **D-03:** Deleting or editing a sales order restores the previous lot's quantity before applying the
  new quantity/lot — same reverse-then-reapply pattern already used for `Product.stockQty` via
  `reverseAndDeleteByReferenceTx` in `stockTransaction.model.ts`; extend that same function (or a
  lot-aware sibling) to also touch `InventoryStock.quantityOnHand`.

### Import Receiving → Lot Creation
- **D-04:** `InventoryStock` lots (and the corresponding stock-IN `StockTransaction`) are created only
  when an import order's status is set to (or transitions to) `RECEIVED` — not at order creation as
  today. This closes a real bug: `ImportOrderModel.create()` currently fires stock-IN unconditionally
  regardless of status, so an order sitting at `STAGING`/`PENDING_APPROVAL` already counts as received
  stock. Matches the PDF's distinct "Warehouse Receiving" step (separate from "Purchase Order
  Creation") and Thai requirements doc FR-13 (record actual received qty vs. ordered, alert on
  mismatch).
- Lot/batch numbering: derive from `{orderNo}-{itemIndex}` (same pattern as existing
  `transactionNo` generation in `stockTransaction.model.ts`) unless the receiving flow captures an
  explicit lot/batch number from the user — planner/researcher to confirm during implementation
  whether receiving captures a real lot number or auto-generates one; either is acceptable, prefer
  auto-generated with an optional override field if cheap to add.

### Credit & Discount Limit Enforcement (interim, ahead of Phase 4)
- **D-05:** A sales order that would push `Customer.currentBalance` over `Customer.creditLimit`, or
  whose discount exceeds `Customer.standardDiscount`, is not hard-rejected. Instead it's flagged with
  a minimal "requires approval" indicator (a boolean or lightweight status field — planner's
  discretion on exact schema shape) that blocks the order's stock deduction until a user with
  `SALES_ORDER_APPROVE` permission (Manager/Approver role) approves it via the existing Phase 2
  approve endpoint. Phase 4 replaces this flag with the full DRAFT/PENDING_APPROVAL/APPROVED/etc.
  status machine — this interim mechanism should be structured so Phase 4 can upgrade it without
  throwing away the credit/discount threshold-check logic itself, only the state representation.
- No-self-approval (ENFORCE-06) already exists at the Phase 2 approve/reject endpoints (reject if
  requester is the order's `createdBy`) — this phase's interim approval flag reuses that same
  endpoint/check, no new no-self-approval logic needed here.

### Stock-Adjustment Reason Codes
- **D-06:** Manual `InventoryStock.quantityOnHand` edits are blocked at the model layer (no direct
  CRUD update to that field). Corrections go through a new audited stock-adjustment action with a
  fixed reason code: `DAMAGE`, `THEFT`, `RECOUNT`, `EXPIRY`, `CORRECTION`, `OTHER` (plus a free-text
  note field for detail). Uses the existing Phase 2 audit-log mechanism (before/after snapshot).
- Permission: gate the stock-adjustment action behind a Warehouse & Distribution Officer-level
  permission (matches PDF §11's role table: Warehouse Staff → receiving/shipping/inventory), reusing
  Phase 2's `requirePermission` pattern.

### Rounding (carried forward — already resolved, do not re-ask)
- Per-line rounding, standard round-half-up to 2 decimals; sum lines for totals. Matches Thai VAT
  invoice convention. Resolved 2026-09-14, applies to any new price/discount/tax math this phase
  introduces (e.g. credit/discount threshold comparisons).

### Claude's Discretion
- Exact schema shape of the interim "requires approval" flag (boolean field vs. small enum) — D-05
  leaves this to the planner, as long as it's structured for a clean Phase 4 upgrade.
- Whether import-order receiving captures an explicit lot/batch number or auto-generates one from
  `orderNo` — D-04's numbering note leaves room for either.
- HTTP verb/endpoint shape for the new stock-adjustment action.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & Priority
- `liquor-system-improvement-advice.md` §1 "Lot/Batch Stock Control" and §2 "Backend Business Rule
  Enforcement" — requirements + acceptance criteria for this phase
- `liquor-import-system-requirements (1).md` FR-13 (receiving qty mismatch alert), FR-15 (real-time
  stock on receive), FR-18 (sell only from "ready to sell" stock), FR-21 (credit limit block/warn),
  FR-22 (discount-over-threshold needs approval), NFR-07 (near-real-time stock to avoid overselling)
- `thailand_alcohol_import_sales_system_overview.pdf` §4 (overall flow — distinct Warehouse Receiving
  step) and §5.9 (Warehouse/Inventory Management — lot/shipment-level tracking)

### Project-Level
- `.planning/PROJECT.md` — core value (backend-first enforcement), constraints
- `.planning/REQUIREMENTS.md` — ENFORCE-01 through ENFORCE-06, STOCK-01 through STOCK-06 with full
  requirement text
- `.planning/ROADMAP.md` §"Phase 3: Backend Enforcement & Lot/Batch Stock Control" — goal, success
  criteria, dependency on Phase 2
- `spec-gap-closure-plan.md` — background on how this phase's scope was cross-checked against the PDF

### Prior Phase Precedent
- `.planning/phases/02-rbac-audit-logging/02-CONTEXT.md` — establishes the minimal
  approve/reject-ahead-of-full-workflow pattern (D-05 above reuses this), the no-self-approval check
  already in place, and the `requirePermission` middleware this phase's stock-adjustment gate builds
  on top of

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/backend/src/models/stockTransaction.model.ts` — `createStockTransactionTx` /
  `reverseAndDeleteByReferenceTx` already implement the create/decrement and
  reverse-then-reapply pattern for `Product.stockQty`; extend the same shape one level down to
  `InventoryStock.quantityOnHand`
- `apps/backend/src/utils/licenseGate.ts` (`assertProductsNotBlockedTx`) — existing pattern for a
  transaction-scoped guard function; the new credit/discount/lot-quantity guards should follow the
  same shape (take `tx`, throw `HttpError` on violation)
- `apps/backend/src/utils/stockReference.ts` — existing `salesOrderStockReference`/
  `importOrderStockReference` helpers for reference-number generation; reuse for lot/batch numbering
  if auto-generating from `orderNo`
- Phase 2's `requirePermission` middleware and audit-log utility — reuse directly for the
  stock-adjustment action's permission gate and audit trail

### Established Patterns
- All order mutations (`salesOrder.model.ts`, `importOrder.model.ts`) already run inside
  `client.$transaction`, with a `Client = PrismaClient | Prisma.TransactionClient` type and a `run`
  closure — new lot/credit/discount logic should slot into the same transaction, not a separate one
- `SalesOrderModel.create`/`update`/`delete` currently call `createStockOutTx`/
  `reverseAndDeleteByReferenceTx` unconditionally — this is exactly where lot-level FK validation and
  decrement logic needs to be inserted
- `ImportOrderModel.create` currently calls `createStockInTx` unconditionally regardless of `status`
  — this is the bug D-04 fixes; the gating check belongs here (and in `update`, when status changes
  to `RECEIVED`)

### Integration Points
- `apps/backend/prisma/schema.prisma` — `SalesOrderItem.lotBatch` (String) becomes a FK
  (`inventoryStockId Int`) relation to `InventoryStock`; `InventoryStock` needs no new fields for
  D-01–D-04, but the interim approval flag (D-05) needs a new field on `SalesOrder`; stock-adjustment
  (D-06) needs a new transaction type or dedicated model — planner's discretion
- `apps/backend/prisma/seed.ts` — has `ImportOrder` seed rows at `STAGING`/`PENDING_APPROVAL`/
  `APPROVED`/`CUSTOMS_CLEARED`/`RECEIVED`/`ISSUE` statuses already; seed data will need adjustment
  once stock-IN is gated to `RECEIVED` only (currently all seeded rows implicitly get stock regardless
  of status)

</code_context>

<specifics>
## Specific Ideas

No additional specific visual/UX references — this is a backend-only phase (no new UI screens; sales
order and import order forms already exist from prior phases and just gain new validation/fields).

</specifics>

<deferred>
## Deferred Ideas

- Full approval status machine (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED) — Phase 4, per
  roadmap; this phase's interim flag (D-05) is explicitly a placeholder for it
- Landed cost (freight/insurance/customs fees) allocation — Phase 5, already resolved (allocate by
  value) per memory `project-open-decisions-resolved`
- Multi-branch/warehouse structure — deferred until a real second site exists (Phase 7 scope note);
  `InventoryStock.warehouse` stays a plain string this phase too
- Document generation (picking list, receiving report) — Phase 6

</deferred>

---

*Phase: 03-backend-enforcement-lot-batch-stock-control*
*Context gathered: 2026-09-15*
