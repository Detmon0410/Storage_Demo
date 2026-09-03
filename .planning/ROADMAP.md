# Roadmap: Storage Demo — Production Readiness

## Overview

This milestone hardens an early-MVP liquor import/sales/distribution system into a production-ready one. It starts from zero authentication and ends with full backend-enforced business rules, lot-level inventory truth, a real approval workflow, liquor tax/compliance data, and document generation/reporting. The six phases below follow the dependency chain confirmed by research: identity must exist before permissions can be checked or actions attributed; permissions and audit must exist before enforcement can be trusted; lot-level stock and rule enforcement are co-designed as one layer; approval depends on both and must revisit the stock-deduction trigger point established earlier; tax/compliance data is largely independent but its payoff lands in the final documents/reporting phase, which depends on everything before it.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Authentication** - Users log in/out with hashed passwords and short-lived tokens; every existing API route requires a valid session
- [ ] **Phase 2: RBAC & Audit Logging** - 6-role permission system enforced server-side per endpoint; every create/update/delete/approve/reject/login/export is recorded in an append-only audit log
- [ ] **Phase 3: Backend Enforcement & Lot/Batch Stock Control** - License, stock, credit, and discount rules are enforced server-side; InventoryStock lots become the sole source of truth for quantity
- [ ] **Phase 4: Approval Workflow** - Orders move through a real DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED status machine, self-approval is blocked, and stock deducts only on approval
- [ ] **Phase 5: Liquor Tax & Compliance Data** - Products and import orders capture HS code, excise, ABV, landed cost inputs, and permit/document references; incomplete products are flagged
- [ ] **Phase 6: Documents & Reporting** - Users generate invoices, delivery notes, picking lists, and reports; dashboard KPIs compute from live data

## Phase Details

### Phase 1: Authentication
**Goal**: Users must log in before accessing the system; no anonymous access to business data
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07
**Success Criteria** (what must be TRUE):
  1. User can log in with username/email and password and receive a short-lived access token plus a refresh token
  2. User can log out, and the previously issued refresh token no longer works
  3. A logged-in user's session survives a browser refresh without re-entering credentials
  4. Every existing API route rejects requests with no valid session (401), and passwords are never stored or logged in plaintext
  5. Repeated failed login attempts from the same account/origin are throttled, and only the known frontend origin(s) can call the API (CORS restricted)
**Plans**: 9 plans

Plans:
- [ ] 01-01-PLAN.md — Backend schema (User/RefreshToken), dependencies, seed bootstrap (D-05)
- [ ] 01-02-PLAN.md — Test infra (vitest/supertest) + JWT/refresh-token/user model core (TDD)
- [ ] 01-03-PLAN.md — requireAuth middleware + CORS/cookieParser wiring (D-09, AUTH-07)
- [ ] 01-04-PLAN.md — Login/refresh/logout endpoints + rate limiting (AUTH-01/02/03/06)
- [ ] 01-05-PLAN.md — Frontend AuthContext + API client wiring (D-08 stage 2)
- [ ] 01-06-PLAN.md — Login page, route guard, App/Topbar wiring (checkpoint)
- [ ] 01-07-PLAN.md — Enforce auth on read endpoints (D-08 stage 3)
- [ ] 01-08-PLAN.md — Enforce auth on write endpoints (D-08 stage 4)
- [ ] 01-09-PLAN.md — Enforce auth on destructive endpoints + final verification (D-08 stage 5, checkpoint)

### Phase 2: RBAC & Audit Logging
**Goal**: Every mutating action is gated by a real permission check and recorded for accountability
**Depends on**: Phase 1
**Requirements**: RBAC-01, RBAC-02, RBAC-03, RBAC-04, RBAC-05, RBAC-06, AUDIT-01, AUDIT-02, AUDIT-03, AUDIT-04
**Success Criteria** (what must be TRUE):
  1. System Admin can create/edit/deactivate/reactivate users and assign one or more of the 6 defined roles to a single user
  2. A user's effective permissions are the union of all assigned roles, and a mutating API endpoint denies a request from a user lacking the required permission regardless of frontend UI state
  3. Revoking a user's role takes effect on their very next request, without requiring the user to log in again
  4. Every create/update/delete, plus login, logout, approve, reject, and export actions, are recorded with user, timestamp, entity, and before/after values
  5. No screen or API endpoint can edit or delete an audit log entry, and an authorized user can filter audit history by entity, user, action, and date range
**Plans**: TBD

### Phase 3: Backend Enforcement & Lot/Batch Stock Control
**Goal**: Invalid business actions (expired license, overselling, uncontrolled credit/discount) are rejected at the backend regardless of caller
**Depends on**: Phase 2
**Requirements**: ENFORCE-01, ENFORCE-02, ENFORCE-03, ENFORCE-04, ENFORCE-05, ENFORCE-06, STOCK-01, STOCK-02, STOCK-03, STOCK-04, STOCK-05, STOCK-06
**Success Criteria** (what must be TRUE):
  1. Backend rejects a sales order when the customer's license is expired, revoked, suspended, or missing, even if submitted directly via API
  2. Backend rejects a sales order line that exceeds the selected lot's available quantity, and product-level stock is always derived from lot quantities rather than edited independently
  3. Creating a sales order decrements the selected lot's quantity within the same transaction, and deleting or editing an order correctly restores the prior lot quantity before applying the new one
  4. Import receiving creates or updates inventory lots with received quantity, warehouse, received date, and lot/batch number, and every stock transaction records product, lot, source document, and movement type
  5. A sales order exceeding the customer's credit limit or an unapproved discount limit is rejected unless routed to approval, invalid data (negative quantities, invalid prices/discounts/status transitions) produces a clear error, a user cannot approve a transaction they created or last edited, and manual stock quantity edits are blocked except through an audited stock-adjustment transaction with a reason code
**Plans**: TBD

### Phase 4: Approval Workflow
**Goal**: Orders that require sign-off go through a real, tamper-resistant approval process before affecting stock
**Depends on**: Phase 3
**Requirements**: APPROVAL-01, APPROVAL-02, APPROVAL-03, APPROVAL-04, APPROVAL-05, APPROVAL-06
**Success Criteria** (what must be TRUE):
  1. Import orders and sales orders carry a real status of DRAFT, PENDING_APPROVAL, APPROVED, REJECTED, or CANCELLED
  2. An order in any non-APPROVED state has no effect on final stock or delivery; stock is decremented exactly at the moment an order transitions to APPROVED
  3. Approving or rejecting an order records the approver, timestamp, decision, and a reason when rejected
  4. An order that exceeds the customer's credit limit or discount limit threshold is automatically routed to PENDING_APPROVAL before it can proceed
  5. A user holding Manager/Approver permission can approve or reject a pending order; a user without that permission is rejected by the backend if they attempt it
**Plans**: TBD

### Phase 5: Liquor Tax & Compliance Data
**Goal**: Products and import orders carry the regulatory and cost data required for lawful liquor trading
**Depends on**: Phase 3 (uses same product/import order data model; independent of Phase 4)
**Requirements**: TAX-01, TAX-02, TAX-03, TAX-04, TAX-05
**Success Criteria** (what must be TRUE):
  1. A product record can store HS code, excise category, alcohol type, ABV, package size, bottle/carton conversion, and origin country
  2. An import order can record customs duty, excise tax, VAT, freight, insurance, and a computed landed cost
  3. The system calculates required stamp quantity from the actual bottle quantity on an import order
  4. An import order stores import permit, customs entry, excise document, and related document references
  5. A product missing any required compliance field is visibly flagged and cannot be marked ready for sale until resolved
**Plans**: TBD

### Phase 6: Documents & Reporting
**Goal**: Users can produce the trade documents and reports the business needs, backed by live data
**Depends on**: Phase 3, Phase 4, Phase 5
**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04
**Success Criteria** (what must be TRUE):
  1. A user can generate a sales invoice, tax invoice, delivery note, and picking list from a sales order
  2. A user can generate an import order summary and a receiving report from an import order
  3. A user can export a report to CSV or PDF, filtered by date, customer, supplier, product, status, and warehouse
  4. Dashboard KPIs are calculated from live operational data instead of manually maintained KPI rows
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Authentication | 0/9 | Not started | - |
| 2. RBAC & Audit Logging | 0/TBD | Not started | - |
| 3. Backend Enforcement & Lot/Batch Stock Control | 0/TBD | Not started | - |
| 4. Approval Workflow | 0/TBD | Not started | - |
| 5. Liquor Tax & Compliance Data | 0/TBD | Not started | - |
| 6. Documents & Reporting | 0/TBD | Not started | - |
</content>
