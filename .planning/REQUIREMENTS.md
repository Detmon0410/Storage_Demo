# Requirements: Storage Demo — Production Readiness

**Defined:** 2026-09-03
**Core Value:** The system must prevent invalid business actions (selling without a valid license, overselling stock, bypassing approval) at the backend — not just hide buttons in the UI.

## v1 Requirements

### Authentication (AUTH)

- [ ] **AUTH-01**: User can log in with username/email and password
- [ ] **AUTH-02**: User can log out, invalidating their session/refresh token
- [ ] **AUTH-03**: User session persists across browser refresh via short-lived access token + refresh token
- [ ] **AUTH-04**: All existing API routes require a valid authenticated session (no anonymous access to business data)
- [ ] **AUTH-05**: Passwords are stored hashed (never plaintext), using a modern hashing algorithm
- [ ] **AUTH-06**: Login attempts are rate-limited to resist brute-force attacks
- [ ] **AUTH-07**: CORS is restricted to known frontend origin(s) instead of allowing all origins

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

- [ ] **ENFORCE-01**: Backend rejects a sales order if the customer's liquor license is expired, revoked, suspended, or missing
- [ ] **ENFORCE-02**: Backend rejects a sales order line that exceeds the selected lot/batch's available quantity
- [ ] **ENFORCE-03**: Backend rejects a sales order that exceeds the customer's credit limit unless routed through approval
- [ ] **ENFORCE-04**: Backend requires approval when a discount exceeds the customer's allowed discount limit
- [ ] **ENFORCE-05**: Backend rejects negative quantities, invalid prices, invalid discounts, and invalid status transitions with a clear error message
- [ ] **ENFORCE-06**: A user cannot approve a transaction they created or last edited, regardless of their role combination

### Lot/Batch Stock Control (STOCK)

- [ ] **STOCK-01**: `InventoryStock` (lot/batch level) is the source of truth for stock quantity; product-level stock is derived/synced from it, not maintained independently
- [ ] **STOCK-02**: Creating a sales order decreases the selected lot's on-hand quantity within the same transaction
- [ ] **STOCK-03**: Deleting or editing a sales order restores the previous lot quantity before applying the new quantity
- [ ] **STOCK-04**: Import receiving creates or updates inventory lots with received quantity, warehouse, received date, and lot/batch number
- [ ] **STOCK-05**: Stock transactions reference product, lot/batch, source document, and movement type
- [ ] **STOCK-06**: Manual stock quantity edits are not permitted directly; corrections require an audited stock-adjustment transaction with a reason code

### Approval Workflow (APPROVAL)

- [ ] **APPROVAL-01**: Import orders and sales orders support statuses DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, and CANCELLED
- [ ] **APPROVAL-02**: An order in a non-APPROVED state does not affect final stock or delivery
- [ ] **APPROVAL-03**: Stock is decremented at the point an order transitions to APPROVED, not at order creation
- [ ] **APPROVAL-04**: Approving or rejecting an order records the approver, timestamp, decision, and (if rejected) a reason
- [ ] **APPROVAL-05**: Orders exceeding credit limit or discount limit thresholds automatically require approval before proceeding
- [ ] **APPROVAL-06**: A user with Manager/Approver permission can approve or reject a pending order; a user without that permission cannot

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
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| AUTH-05 | Phase 1 | Pending |
| AUTH-06 | Phase 1 | Pending |
| AUTH-07 | Phase 1 | Pending |
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
| APPROVAL-01 | Phase 4 | Pending |
| APPROVAL-02 | Phase 4 | Pending |
| APPROVAL-03 | Phase 4 | Pending |
| APPROVAL-04 | Phase 4 | Pending |
| APPROVAL-05 | Phase 4 | Pending |
| APPROVAL-06 | Phase 4 | Pending |
| TAX-01 | Phase 5 | Pending |
| TAX-02 | Phase 5 | Pending |
| TAX-03 | Phase 5 | Pending |
| TAX-04 | Phase 5 | Pending |
| TAX-05 | Phase 5 | Pending |
| DOCS-01 | Phase 6 | Pending |
| DOCS-02 | Phase 6 | Pending |
| DOCS-03 | Phase 6 | Pending |
| DOCS-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 44 total
- Mapped to phases: 44
- Unmapped: 0 ✓

---
*Requirements defined: 2026-09-03*
*Last updated: 2026-09-03 after initial definition*
