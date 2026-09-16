# Requirements: Storage Demo — Production Readiness

**Defined:** 2026-09-03
**Core Value:** The system must prevent invalid business actions (selling without a valid license, overselling stock, bypassing approval) at the backend — not just hide buttons in the UI.

## v1 Requirements

### Authentication (AUTH)

- [x] **AUTH-01**: User can log in with username/email and password
- [x] **AUTH-02**: User can log out, invalidating their session/refresh token
- [x] **AUTH-03**: User session persists across browser refresh via short-lived access token + refresh token
- [x] **AUTH-04**: All existing API routes require a valid authenticated session (no anonymous access to business data)
- [x] **AUTH-05**: Passwords are stored hashed (never plaintext), using a modern hashing algorithm
- [x] **AUTH-06**: Login attempts are rate-limited to resist brute-force attacks
- [x] **AUTH-07**: CORS is restricted to known frontend origin(s) instead of allowing all origins

### Roles & Permissions (RBAC)

- [ ] **RBAC-01**: System supports 6 roles (System Admin, Manager/Approver, Import & Compliance Officer, Warehouse & Distribution Officer, Sales Officer, Finance/Accounting Officer) per the role recommendation doc
- [ ] **RBAC-02**: A user can be assigned one or more roles simultaneously
- [ ] **RBAC-03**: A user's effective permissions are the union of permissions from all assigned roles
- [ ] **RBAC-04**: Every mutating API endpoint checks the caller's permission before executing, independent of frontend UI state
- [ ] **RBAC-05**: System Admin can create, edit, deactivate, and reactivate users, and assign/remove roles
- [ ] **RBAC-06**: Permission checks are re-derived from the database per request (not baked into a long-lived token) so revoking a role takes effect without re-login

### Audit Logging (AUDIT)

- [ ] **AUDIT-01**: Every create, update, and delete on business entities is recorded with user, timestamp, entity, and before/after values
- [ ] **AUDIT-02**: Login, logout, approve, reject, and export actions are recorded as audit events (not only generic CRUD)
- [ ] **AUDIT-03**: Audit log entries cannot be edited or deleted through any application screen or API endpoint
- [ ] **AUDIT-04**: Authorized users can view audit history filtered by entity, user, action, and date range

### Backend Business Rule Enforcement (ENFORCE)

- [x] **ENFORCE-01
**: Backend rejects a sales order if the customer's liquor license is expired, revoked, suspended, or missing
- [x] **ENFORCE-02
**: Backend rejects a sales order line that exceeds the selected lot/batch's available quantity
- [x] **ENFORCE-03
**: Backend rejects a sales order that exceeds the customer's credit limit unless routed through approval
- [x] **ENFORCE-04
**: Backend requires approval when a discount exceeds the customer's allowed discount limit
- [x] **ENFORCE-05
**: Backend rejects negative quantities, invalid prices, invalid discounts, and invalid status transitions with a clear error message
- [x] **ENFORCE-06
**: A user cannot approve a transaction they created or last edited, regardless of their role combination

### Lot/Batch Stock Control (STOCK)

- [x] **STOCK-01
**: `InventoryStock` (lot/batch level) is the source of truth for stock quantity; product-level stock is derived/synced from it, not maintained independently
- [x] **STOCK-02
**: Creating a sales order decreases the selected lot's on-hand quantity within the same transaction
- [x] **STOCK-03
**: Deleting or editing a sales order restores the previous lot quantity before applying the new quantity
- [x] **STOCK-04
**: Import receiving creates or updates inventory lots with received quantity, warehouse, received date, and lot/batch number
- [ ] **STOCK-05**: Stock transactions reference product, lot/batch, source document, and movement type
- [ ] **STOCK-06**: Manual stock quantity edits are not permitted directly; corrections require an audited stock-adjustment transaction with a reason code

### Approval Workflow (APPROVAL)

- [x] **APPROVAL-01
**: Import orders and sales orders support statuses DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, and CANCELLED
- [x] **APPROVAL-02
**: An order in a non-APPROVED state does not affect final stock or delivery
- [x] **APPROVAL-03
**: Stock is decremented at the point an order transitions to APPROVED, not at order creation
- [x] **APPROVAL-04
**: Approving or rejecting an order records the approver, timestamp, decision, and (if rejected) a reason
- [x] **APPROVAL-05**: Orders exceeding credit limit or discount limit thresholds automatically require approval before proceeding
- [x] **APPROVAL-06
**: A user with Manager/Approver permission can approve or reject a pending order; a user without that permission cannot

### Liquor Tax & Compliance Data (TAX)

- [ ] **TAX-01**: Product records support HS code, excise category, alcohol type, ABV, package size, bottle/carton conversion, and origin country
- [ ] **TAX-02**: Import orders capture customs duty, excise tax, VAT, freight, insurance, and landed cost
- [ ] **TAX-03**: System calculates stamp quantity based on actual bottle quantity
- [ ] **TAX-04**: Import orders store import permit, customs entry, excise document, and related document references
- [ ] **TAX-05**: A product missing required compliance fields is visibly flagged before it can be marked ready for sale

### Documents & Reporting (DOCS)

- [ ] **DOCS-01**: User can generate a sales invoice, tax invoice, delivery note, and picking list from a sales order
- [ ] **DOCS-02**: User can generate an import order summary and receiving report from an import order
- [ ] **DOCS-03**: User can export reports to CSV or PDF, filterable by date, customer, supplier, product, status, and warehouse
- [ ] **DOCS-04**: Dashboard KPIs are calculated from live operational data instead of manually maintained KPI rows

### Company Profile & Permit Deadlines (COMPANY, PERMIT)

- [x] **COMPANY-01**: System stores one Company profile (legal name, Tax ID, address) reused across permits and generated documents instead of being re-typed
- [x] **PERMIT-01**: A `License` record links to the Company and, optionally, to a specific Product; existing unlinked licenses remain valid
- [x] **PERMIT-02**: Permit status auto-derives from days-to-expiry using tiers: 120d = Preparation for renewal, 90d = Notify, 60d = Warning, 30d = Important warning, 0d = Expired
- [x] **PERMIT-03**: Dashboard surfaces permits grouped by threshold bucket (120/90/60/30 days, expired) instead of a single "expiring soon" list
- [x] **PERMIT-04**: An expired permit is visibly flagged (red), and if linked to a specific product, blocks new import/sales orders for that product until resolved

### Import Documents & Shipment Details (SHIPMENT)

- [ ] **SHIPMENT-01**: `ImportOrder` captures ETD, B/L/AWB number, and container number
- [ ] **SHIPMENT-02**: A shipment supports file/attachment upload (invoice, packing list, B/L, CO, import declaration, tax documents) linked to it, stored on local disk
- [ ] **SHIPMENT-03**: A required-document checklist is generated at shipment creation; missing required documents are visibly flagged before the shipment can proceed
- [ ] **SHIPMENT-04**: Uploaded documents are categorized and named by shipment number and document type

### Quotation & Picking (QUOTE)

- [ ] **QUOTE-01**: System supports a `Quotation` entity preceding `SalesOrder` in the sales sequence (quotation → order)
- [ ] **QUOTE-02**: A Quotation can be converted into a SalesOrder without re-entering line items
- [ ] **QUOTE-03**: SalesOrder supports a picking/allocation step between APPROVED and shipped, recording who picked the order and when

### License/Permit Model Parity (LICENSE)

- [ ] **LICENSE-01**: `License` supports a `status` field (ACTIVE, PREPARING_RENEWAL, RENEWING, EXPIRED, SUSPENDED) distinct from the computed day-count notification bucket
- [ ] **LICENSE-02**: `License` stores `governingAuthority`
- [ ] **LICENSE-03**: `License` supports `documentUrl`, `notes`, and audit fields (createdBy/createdAt/updatedBy/updatedAt/statusChangedBy/statusChangedAt), mirroring `CustomerLicense`
- [ ] **LICENSE-04**: `License` supports a renewal chain (`renewedFromId`/`renewedTo`), mirroring `CustomerLicense`
- [ ] **LICENSE-05**: A user with Compliance Staff permission can transition `License.status`; a user without it cannot
- [ ] **LICENSE-06**: `licenseGate.ts` blocks new import/sales orders when the linked `License.status` is SUSPENDED, in addition to the existing expiry-date check

### Billing, Payment & Receivables (BILLING)

- [ ] **BILLING-01**: System stores `Invoice` records (invoice date, due date, linked sales order) replacing the bare `invoiceNo` string
- [ ] **BILLING-02**: System stores `Payment` records (payment date, amount, method) linked to an Invoice
- [ ] **BILLING-03**: System computes outstanding balance and delinquency status per invoice from recorded payments
- [ ] **BILLING-04**: `Customer.currentBalance` is derived from outstanding invoices, not manually maintained
- [ ] **BILLING-05**: Accounts-receivable aging (current / 30 / 60 / 90+ days overdue) is available per customer

## v2 Requirements

Deferred to a future milestone once v1 data models are live and validated.

### Traceability & Cost (TRACE)

- **TRACE-01**: Full lot-level traceability report from import order → lot → sales order
- **TRACE-02**: Landed cost calculated per SKU, per bottle, and per carton with a defined cost-allocation method

### Compliance UX (COMP)

- **COMP-01**: Compliance readiness gate/flagging UI surfacing missing compliance data proactively across products

## Out of Scope

| Feature | Reason |
|---------|--------|
| Multi-level (>1 tier) approval chains | Adds significant state-machine complexity before the org has proven it needs more than one tier; schema will support adding this later without a rewrite |
| 8-role granular structure (splitting Manager into Senior Manager/Supervisor, etc.) | Premature for current org size; the 6-role schema (roles/permissions as separate tables) already supports splitting later |
| Third-party auth/SSO provider (Auth0, Supabase, Clerk) | Introduces external dependency and vendor lock-in inconsistent with existing codebase pattern; no SSO/social-login need identified |
| Real-time push updates (websockets) | Adds infrastructure complexity with limited payoff for an internal B2B tool; on-demand computation is sufficient |
| Automated CI/CD pipeline | Not requested; conflates deployment tooling with this milestone's business-feature hardening focus |
| Manual stock quantity edits without an audited reason | Silently overwriting stock destroys lot traceability and defeats the point of lot/batch source-of-truth; controlled stock-adjustment transactions replace this |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Done |
| AUTH-02 | Phase 1 | Done |
| AUTH-03 | Phase 1 | Done |
| AUTH-04 | Phase 1 | Done |
| AUTH-05 | Phase 1 | Done |
| AUTH-06 | Phase 1 | Done |
| AUTH-07 | Phase 1 | Done |
| RBAC-01 | Phase 2 | Pending |
| RBAC-02 | Phase 2 | Pending |
| RBAC-03 | Phase 2 | Pending |
| RBAC-04 | Phase 2 | Pending |
| RBAC-05 | Phase 2 | Pending |
| RBAC-06 | Phase 2 | Pending |
| AUDIT-01 | Phase 2 | Pending |
| AUDIT-02 | Phase 2 | Pending |
| AUDIT-03 | Phase 2 | Pending |
| AUDIT-04 | Phase 2 | Pending |
| ENFORCE-01 | Phase 3 | Pending |
| ENFORCE-02 | Phase 3 | Pending |
| ENFORCE-03 | Phase 3 | Pending |
| ENFORCE-04 | Phase 3 | Pending |
| ENFORCE-05 | Phase 3 | Pending |
| ENFORCE-06 | Phase 3 | Pending |
| STOCK-01 | Phase 3 | Pending |
| STOCK-02 | Phase 3 | Pending |
| STOCK-03 | Phase 3 | Pending |
| STOCK-04 | Phase 3 | Pending |
| STOCK-05 | Phase 3 | Pending |
| STOCK-06 | Phase 3 | Pending |
| APPROVAL-01 | Phase 4 | Done |
| APPROVAL-02 | Phase 4 | Done |
| APPROVAL-03 | Phase 4 | Done |
| APPROVAL-04 | Phase 4 | Done |
| APPROVAL-05 | Phase 4 | Done |
| APPROVAL-06 | Phase 4 | Done |
| TAX-01 | Phase 5 | Pending |
| TAX-02 | Phase 5 | Pending |
| TAX-03 | Phase 5 | Pending |
| TAX-04 | Phase 5 | Pending |
| TAX-05 | Phase 5 | Pending |
| DOCS-01 | Phase 6 | Pending |
| DOCS-02 | Phase 6 | Pending |
| DOCS-03 | Phase 6 | Pending |
| DOCS-04 | Phase 6 | Pending |
| COMPANY-01 | Phase 7 | Done |
| PERMIT-01 | Phase 7 | Done |
| PERMIT-02 | Phase 7 | Done |
| PERMIT-03 | Phase 7 | Done |
| PERMIT-04 | Phase 7 | Done |
| SHIPMENT-01 | Phase 8 | Pending |
| SHIPMENT-02 | Phase 8 | Pending |
| SHIPMENT-03 | Phase 8 | Pending |
| SHIPMENT-04 | Phase 8 | Pending |
| QUOTE-01 | Phase 8 | Pending |
| QUOTE-02 | Phase 8 | Pending |
| QUOTE-03 | Phase 8 | Pending |
| BILLING-01 | Phase 8 | Pending |
| BILLING-02 | Phase 8 | Pending |
| BILLING-03 | Phase 8 | Pending |
| BILLING-04 | Phase 8 | Pending |
| BILLING-05 | Phase 8 | Pending |
| LICENSE-01 | Phase 9 | Pending |
| LICENSE-02 | Phase 9 | Pending |
| LICENSE-03 | Phase 9 | Pending |
| LICENSE-04 | Phase 9 | Pending |
| LICENSE-05 | Phase 9 | Pending |
| LICENSE-06 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 67 total (49 original + 12 added for Phase 8 + 6 added for Phase 9, from `spec-gap-closure-plan.md`)
- Mapped to phases: 67
- Unmapped: 0 ✓
- Done: 12 (AUTH: 7, COMPANY/PERMIT: 5) — Phases 1 and 7
- Pending: 55 — Phases 2, 3, 4, 5, 6, 8, 9 not yet executed (Phase 2 is planned; Phases 3-6, 8, 9 not yet planned)

**Note:** Phases 7-9 were added after this table's original phase numbering, via `spec-gap-closure-plan.md` (2026-09-11, addendum 2026-09-15), to close gaps found against `thailand_alcohol_import_sales_system_overview.pdf`. Phase 7's requirements (COMPANY-01, PERMIT-01..04) were registered and are now done. Phase 8's requirements (SHIPMENT, QUOTE, BILLING groups above) were registered 2026-09-14. Phase 9's requirements (LICENSE group) were registered 2026-09-15 — closing the §6 permit-model gap identified after Phase 7 shipped (status field, governing authority, attachments, renewal chain, RBAC-gated status transitions).

---
*Requirements defined: 2026-09-03*
*Last updated: 2026-09-15 — Phase 9 (LICENSE) requirements added from `spec-gap-closure-plan.md` addendum*
