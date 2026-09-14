# Spec Gap Closure Plan

Source: `thailand_alcohol_import_sales_system_overview.pdf` (Ver. 1.0, 2026-09-11) vs current codebase.
Builds on the existing `.planning/ROADMAP.md` (Phases 1–6, Auth → RBAC/Audit → Enforcement/Lot Stock → Approval → Tax/Compliance → Documents) and folds in what that roadmap does **not** cover: company/branch structure, import document/file attachments, and quotation/picking steps.

## 1. Current State

Built (Phase-1-level CRUD): Products, Categories, Suppliers, Customers, Licenses, CustomerLicenses, Import Orders, Sales Orders, Inventory/Stock Transactions, Dashboard KPIs, Login.

Not built: company/branch master, permit-notification tiers, shipment doc fields (B/L, AWB, container, ETD), file/document storage, full landed cost (freight/insurance/customs fees), quotation + picking step, invoicing/payment/AR, document PDF generation, approval workflow, RBAC, audit log.

## 2. Plan — Phases

Numbering matches `.planning/ROADMAP.md` where it already exists; new phases are appended (7–8) rather than renumbering, to avoid disturbing in-flight work.

| # | Phase | Status | Closes spec gap |
|---|-------|--------|------------------|
| 1 | Authentication | Done | — |
| 2 | RBAC & Audit Logging | Not started | §11 Authority Management |
| 3 | Backend Enforcement & Lot/Batch Stock Control | Not started | §5.9 Warehouse/Inventory (traceability) |
| 4 | Approval Workflow | Not started | §9 Approval/Version Management |
| 5 | Liquor Tax & Compliance Data | Not started | §5.8 Import Cost (partial: excise/ABV/landed cost inputs) |
| 6 | Documents & Reporting | Not started | §7 Document Automation, §10 Dashboards/Reports (partial) |
| **7 (new)** | **Company/Branch & Permit Deadlines** | Not started | §5.1 Company & Branch Management, §5.2 tiered permit notifications |
| **8 (new)** | **Import Documents, Quotation & Billing** | Not started | §5.7 Import Document Management, §5.11 Quotation/Picking step, §5.12 Billing/Payment/Receivables, §8 Document/File checklist |

### Phase 7: Company/Branch & Permit Deadlines
**Goal**: Company/branch/warehouse structure exists; permits are linked to it and notify on a tiered schedule.
**Depends on**: Phase 2 (RBAC, for who gets notified/can edit)
- Add `Company`, `Branch`/`Warehouse` models (replace the free-text `warehouse` string on `InventoryStock`); Tax ID, address.
- Extend `License` to reference company/branch/product instead of standing alone.
- Notification tiers: 120/90/60/30-day pre-expiry + expired, surfaced on dashboard and (later) email.

### Phase 8: Import Documents, Quotation & Billing
**Goal**: Shipments carry real trade documents, sales has a quotation step, and money owed is tracked.
**Depends on**: Phase 3 (stock truth), Phase 6 (document generation plumbing)
- File/attachment storage per shipment (invoice, packing list, B/L, CO, import declaration, tax docs), with a required-document checklist at shipment creation.
- Add ETD, B/L/AWB, container fields to `ImportOrder`.
- Add `Quotation` entity ahead of `SalesOrder` (quotation → order → picking → delivery → invoice).
- Add `Invoice`/`Payment` models: invoice date, due date, payment date/amount, outstanding balance, delinquency status — replacing the bare `invoiceNo` string; ties into `Customer.currentBalance`.

## 3. Draft Workflow (spec §4, mapped to entities)

```
Supplier (Supplier)
   │
   ▼
Product Registration (Product, Category)
   │
   ▼
Permit/License Check (License ── Phase 7: scoped to Company/Branch/Product)
   │
   ▼
Purchase Order Creation (ImportOrder, status=STAGING)
   │
   ▼
Overseas Shipping ── Phase 8: ETD/B-L/AWB/container fields
   │
   ▼
Shipment Management (ImportOrder, status progression)
   │
   ▼
Import Document Check ── Phase 8: file checklist (Invoice/PackingList/B-L/License/Customs/Tax)
   │
   ▼
Customs/Tax Management (ImportOrderItem.taxRate/taxAmount; Phase 5: excise/ABV/HS code)
   │
   ▼
Landed Cost Calculation ── Phase 5: + freight/insurance/customs fees
   │
   ▼
Warehouse Receiving (StockTransaction IN, status=RECEIVED)
   │
   ▼
Lot/Inventory Management (InventoryStock, per lotBatch ── Phase 3: sole source of truth)
   │
   ▼
Customer Order
   ├─ Quotation ── Phase 8: new step, not yet built
   ▼
Sales Order (SalesOrder) ── Phase 4: DRAFT→PENDING_APPROVAL→APPROVED→REJECTED/CANCELLED
   │
   ▼
Inventory Allocation / Picking ── Phase 8: new step
   │
   ▼
Shipping (StockTransaction OUT, deliveryStatus)
   │
   ▼
Invoicing ── Phase 8: Invoice model (replaces invoiceNo string)
   │
   ▼
Payment ── Phase 8: Payment model, AR aging
   │
   ▼
Sales, Profit, Inventory, Receivables Analysis (DashboardKpi ── Phase 6: computed from live data, + Phase 8 AR feed)
```

Every step above is gated, going forward, by Phase 2's RBAC (who may act) and logged by Phase 2's audit trail (who did act) — cross-cutting rather than a single position in the flow.

## 4. Sequencing Rationale

- Phase 7 can run in parallel with Phase 4/5 — it touches new master tables (Company/Branch) and doesn't depend on the enforcement/approval work.
- Phase 8 deliberately sits last: quotation/picking and invoicing/AR are only meaningful once stock is authoritative (Phase 3) and orders have a real approval gate (Phase 4) to hang "who signed off before we invoiced" on.
- AI/OCR (spec §13) stays out of scope — spec itself marks it Phase 4/future, after everything above.

## 5. Open Questions — Resolved

- **Multi-branch/warehouse**: trimmed. No second site exists in current data; Phase 7 adds a single `Company` profile only. `Branch`/`Warehouse` tables are deferred until a real second site exists; `InventoryStock.warehouse` stays a plain string.
- **Billing integration**: record-keeping only for Phase 8 (dates/amounts/status). The spec itself scopes bank/accounting integration to its own future "Phase 4: AI/Linkage", not here.
- **Import document checklist audience**: internal staff only. "Documents for customs brokers" is a generated output, not broker portal access — no external accounts in scope.

Phase 7 is now registered in `.planning/REQUIREMENTS.md` (COMPANY-01, PERMIT-01..04) and `.planning/ROADMAP.md` (goal/depends/success criteria). Next: run `/gsd-plan-phase 7` for the task-level PLAN.md breakdown.
