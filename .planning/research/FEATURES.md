# Feature Research

**Domain:** Production-readiness features for a liquor import/sales/distribution ERP-style system (RBAC, approval workflow, lot/batch inventory, audit logging, tax/compliance, documents/reporting)
**Researched:** 2026-09-03
**Confidence:** MEDIUM-HIGH (project source docs `liquor-system-improvement-advice.md` and `liquor-system-basic-role-permission-recommendation.md` are treated as authoritative requirements per PROJECT.md; general ERP/inventory domain patterns verified via web search to confirm these requirements match standard industry practice)

## Feature Landscape

This is a brownfield, subsequent-milestone research pass. The two source documents already function as a detailed requirements spec for this domain (RBAC for distribution/import ERP, lot/batch traceability, approval workflows). Web research confirms these align with standard ERP/inventory/liquor-distribution practice — nothing found contradicts the source docs; findings below organize and extend them with complexity/dependency notes for roadmap use.

### Table Stakes (Users Expect These)

Features that any production system handling regulated goods (liquor), money (credit/discount), and multi-user access control is assumed to have. Missing these = system is not viable for real operations, only a demo.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Authentication (login/logout, session/token) | No production system exposes business data without login | MEDIUM | Custom auth per existing codebase pattern (no third-party provider per PROJECT.md constraint). Must precede everything else — audit logs need `user`, RBAC needs identity. |
| RBAC with 6 roles + multi-role support | Different departments (sales, warehouse, finance, compliance) must not see or act on data outside their responsibility; standard in any multi-user ERP | MEDIUM-HIGH | Schema: `users`/`roles`/`user_roles`/`permissions`/`role_permissions` (many-to-many both ways). Backend must check permissions on every request, not just hide UI. |
| Backend permission enforcement (defense in depth) | Frontend-only gating is trivially bypassed via direct API calls; auditors/regulators expect server-side control | MEDIUM | Every mutating endpoint needs middleware checking role/permission before executing. This is the #1 standard RBAC pitfall (see PITFALLS). |
| No self-approval rule | Universal internal-control requirement (segregation of duties) in any system with money/compliance impact | LOW-MEDIUM | Must compare `created_by`/`updated_by` against the approving user id at approval time, regardless of role combination. |
| Audit logging (who/when/what/before-after) | Regulatory and internal-control baseline for systems touching licensing, tax, and money | MEDIUM | Standard ERP audit trail fields: user, timestamp, action, entity, before-value, after-value, IP/session where available. Must be append-only (no edit/delete via app). |
| Approval status machine (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED) | Replaces unreliable free-text `approver` field; standard pattern in any ERP order workflow | MEDIUM | Orders in non-approved states must not affect stock/delivery. Requires storing approver, timestamp, decision, rejection reason. |
| Threshold-triggered auto-approval requirement | Standard control: large orders, high discount, or over-credit orders should not be silently approvable by the same person who created them | LOW-MEDIUM | Depends on approval workflow existing first; thresholds (credit limit, discount limit) must be configurable per customer/role. |
| Lot/batch as source of truth for stock | Liquor (and most regulated/perishable goods) is legally traceable by lot/batch from import to sale; without this, recalls/audits/excise reconciliation are impossible | HIGH | `InventoryStock` becomes canonical; product-level quantity becomes derived/synced. Requires transactional decrement/restore logic on order create/edit/delete to avoid stock drift. |
| Prevent overselling (stock + lot level) | Core inventory-system expectation; overselling breaks fulfillment and violates excise/lot accounting | MEDIUM | Must be enforced backend-side at the specific lot, not just aggregate product stock. |
| License validation before sale confirmation | Liquor sales to unlicensed/expired-license customers are typically illegal; core compliance requirement for this domain specifically | MEDIUM | Backend must check license status (active/expired/revoked/suspended/missing) at order-confirmation time, not just at order creation. |
| Credit limit and discount-limit enforcement | Standard AR control in any B2B distribution system to prevent uncontrolled financial exposure | MEDIUM | Ties into approval workflow — over-limit triggers required approval rather than hard block. |
| Core liquor tax/compliance fields on product & import (HS code, excise category, ABV, package size, origin country, customs duty/excise/VAT/landed cost) | Liquor import/distribution is a heavily regulated vertical; without this data the system cannot support legally required tax filings or customs declarations | MEDIUM-HIGH | This is domain-specific table stakes (not generic ERP) — liquor businesses cannot legally operate without these data points captured somewhere. |
| Standard trade documents (sales invoice, tax invoice, delivery note, picking list, import summary, receiving report) | Every liquor wholesale/distribution transaction legally and operationally requires these documents; warehouse staff cannot pick without a picking list | MEDIUM | Can be built as templated PDF/print views generated from existing order/lot data once that data model is correct. |
| CSV/PDF export of reports | Standard expectation for any business system feeding external accounting/compliance/regulatory processes | LOW-MEDIUM | Low complexity once report queries exist; mostly a rendering/formatting concern. |
| Real (computed) dashboard KPIs | Manually-maintained KPI rows are a known anti-pattern flagged in this project's own CONCERNS.md; users expect dashboards to reflect actual state | LOW-MEDIUM | Depends on lot/batch and order data being correct first — computing KPIs from broken source data just produces confidently wrong numbers. |

### Differentiators (Competitive Advantage)

Not required for baseline production-readiness, but valuable in this domain and consistent with the project's stated Core Value ("prevent invalid business actions at the backend").

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Full lot-level traceability report (import order → lot → sales order) | Liquor recalls and excise audits require tracing a specific bottle/carton back to its import batch; few small distribution systems do this well | MEDIUM | Builds directly on lot/batch stock control (Table Stakes) — this is the "so what" payoff of doing lot tracking correctly. |
| Compliance readiness gate ("missing compliance fields visible before goods marked ready for sale") | Proactively surfaces regulatory gaps before they become sale-time failures, rather than discovering at customs or audit time | MEDIUM | Cheap to add once compliance fields exist on the product/import schema — mostly a validation/flagging UI plus a query. |
| Landed cost calculation per SKU / per bottle / per carton | Gives finance real margin visibility per unit including duty/freight/insurance — most small systems only track PO cost | MEDIUM-HIGH | Requires the tax/compliance data model to be in place and a defined allocation method (e.g., proportional by value or by unit) for shared costs like freight/insurance across SKUs in one import order. |
| Role-aware "own vs related" audit log visibility (per permission matrix) | Lets non-admin roles see relevant audit history (their own actions, or entity-scoped) without exposing the full system audit trail — improves trust without an admin bottleneck | LOW-MEDIUM | Straightforward filter on top of the base audit log table; matrix already defined in role doc §7. |
| Approval workflow extensible to multi-level chains | Positions the system to scale with org growth without a schema rewrite | LOW (as a design decision now) / HIGH (if built now) | Design the status/approval tables to allow a future `approval_level` or `approval_chain` concept, but do NOT build multi-level logic in this milestone — explicitly out of scope. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Multi-level (>1 tier) approval chains | Seems like "better governance," easy to imagine wanting for very large orders | Adds significant state-machine complexity (parallel/sequential approvers, partial-approval states, escalation/timeout rules) before the org has proven it needs more than one approval tier; explicitly out of scope per PROJECT.md | Ship single-level approval now; design DB schema (status history table, approver reference) so a second tier can be added later without a rewrite |
| 8-role granular structure (splitting Manager into Senior Manager/Supervisor, etc.) | Looks more "enterprise-grade" and future-proof | Premature for current org size; more roles = more permission-matrix maintenance burden and more edge cases in "who can approve whom" logic, for no near-term benefit | Adopt the 6-role structure now; role/permission schema (roles, permissions, role_permissions as separate tables) already supports splitting later without data migration pain |
| Third-party auth provider (Auth0, Supabase Auth, Clerk, etc.) | Faster to integrate, offloads security surface area | Introduces new external dependency and vendor lock-in inconsistent with existing codebase pattern (no auth libs currently integrated); adds operational complexity (webhook sync, external outage dependency) for a system that doesn't need SSO/social login | Build custom auth (password hashing, session/JWT, login endpoint) matching existing Express/Prisma patterns |
| Real-time everything (live stock dashboards via websockets, live approval notifications) | Feels modern, "why not just push updates instead of polling/refreshing" | Adds infrastructure complexity (websocket server, connection state, reconnection handling) with limited payoff for an internal B2B tool where near-real-time (on page load/refresh) is sufficient | Compute KPIs/stock on request from the database; add polling or manual refresh if staleness becomes an actual complaint |
| Automated CI/CD pipeline as part of this milestone | Feels like it should ship alongside "production readiness" | Explicitly out of scope per PROJECT.md — not requested, and conflating deployment tooling with business-feature hardening dilutes focus of this milestone | Track as a separate future milestone/initiative if the team wants it |
| Manual stock quantity edits without an audited reason/adjustment record | Warehouse staff will ask for a quick "just fix the number" override when counts don't match | Silently overwriting stock quantity destroys lot traceability and defeats the entire point of lot/batch source-of-truth; also flagged as a "should not normally" action in the role doc even for Admin | Require a controlled "stock adjustment" transaction type (reason code, authorized role, audit-logged) rather than direct quantity edits |

## Feature Dependencies

```
Authentication
    └──requires──> (nothing; foundational)

RBAC (roles/permissions/user_roles/role_permissions)
    └──requires──> Authentication (need identity to attach roles to)

Audit Logging
    └──requires──> Authentication (need user id to attribute actions)
    └──enhances──> RBAC (audit "who changed a permission" etc.)

Backend Business Rule Enforcement (license/stock/credit/discount checks)
    └──requires──> RBAC (need to know who is allowed to override/approve)
    └──requires──> Lot/Batch Stock Control (stock checks need real lot data, not stale product-level totals)

Lot/Batch Stock Control (InventoryStock as source of truth)
    └──requires──> Backend enforcement of "no oversell" rule (they are co-designed)
    └──enhances──> Full lot traceability report (differentiator)
    └──enhances──> Picking list / receiving report documents (need lot data to print)

Approval Workflow (status machine + no-self-approval)
    └──requires──> RBAC (need "Manager/Approver" role and permission checks)
    └──requires──> Authentication (need created_by vs approved_by comparison)
    └──enhances──> Backend enforcement (over-credit/over-discount routes into approval instead of hard reject)

Liquor Tax/Compliance Data (HS code, excise, ABV, landed cost fields)
    └──requires──> (mostly independent; schema-level addition to Product/ImportOrder)
    └──enables──> Landed cost calculation (differentiator)
    └──enables──> Compliance readiness gate (differentiator)
    └──enables──> Tax invoice / import summary documents (table stakes)

Documents & Reporting (invoices, picking lists, CSV/PDF export, dashboard KPIs)
    └──requires──> Lot/Batch Stock Control (documents need lot-accurate quantities)
    └──requires──> Approval Workflow (documents/reports need real status, not free-text approver)
    └──requires──> Liquor Tax/Compliance Data (tax invoice needs tax fields)
    └──enhances──> Dashboard KPIs (real computed data instead of manual rows)

Multi-level approval chains [OUT OF SCOPE]
    └──would require──> Approval Workflow (built first, single-level)

8-role structure [OUT OF SCOPE]
    └──would require──> RBAC (built first, 6-role)
```

### Dependency Notes

- **Everything requires Authentication first:** every other feature needs a known `user` to attribute actions, checks permissions against, or restrict access for. This is why the project's suggested implementation order starts here — confirmed correct.
- **Backend Business Rule Enforcement and Lot/Batch Stock Control are tightly coupled:** you cannot correctly enforce "no overselling" until stock is tracked at the lot level; conversely, lot/batch tracking is pointless if the backend doesn't actually check it before confirming an order. The project's suggested order (auth/roles/audit → backend enforcement → lot/batch) should be read as these two being developed as one enforcement layer, with lot/batch as the deeper data-model change.
- **Approval Workflow depends on RBAC existing** (need a real "Manager/Approver" role/permission to gate the approve/reject action) and on Authentication (to compare `created_by` vs. the approving user for the no-self-approval rule).
- **Documents & Reporting is downstream of nearly everything:** invoices need tax fields, picking lists need lot data, and status displays need the real approval state machine — this is correctly sequenced last in the improvement-advice doc.
- **Liquor Tax/Compliance Data is the most schema-independent** of the six areas (mostly additive fields on Product/ImportOrder) and could theoretically be parallelized earlier, but its value (landed cost, tax invoices) isn't realized until Documents & Reporting consumes it — so sequencing it just before that phase, as the source doc suggests, is sound.
- **Multi-level approval and the 8-role split are both scoped-out extensions of features being built now.** Because both explicitly build on top of (not instead of) the single-level/6-role designs, the roadmap should ensure the underlying schemas (status history as its own table rather than fields; roles/permissions as separate join tables rather than an enum on `users`) don't foreclose these extensions later, without implementing the extensions themselves in this milestone.

## MVP Definition

This milestone IS a "v1 hardening" pass on an existing demo system — there is no smaller MVP within it; all six areas are required together to call the system "production-ready" per the project's own Core Value statement. However, within the six areas, sequencing still matters:

### Launch With (v1 of this milestone)

Minimum viable set — the project cannot be called "production ready" without these, and skipping any one leaves a real security/compliance/data-integrity hole:

- [ ] Authentication (login) — nothing else can be attributed to a user without it
- [ ] RBAC (6 roles, multi-role support, backend-enforced permissions) — required before any "approve" or "sensitive field" control means anything
- [ ] Audit logging (create/update/delete/approve/reject/login/export) — required for any real accountability claim
- [ ] Backend enforcement of license/stock/credit/discount rules — this is literally the stated Core Value of the milestone
- [ ] Lot/batch stock control (InventoryStock as source of truth, no oversell) — backend enforcement is meaningless without accurate stock data underneath it
- [ ] Approval workflow (status machine, no self-approval, threshold-triggered approval) — replaces the unreliable free-text approver field that currently provides no real control
- [ ] Liquor tax/compliance core fields (HS code, excise, ABV, landed cost inputs) — legally required data capture for this vertical
- [ ] Core documents (invoice, tax invoice, delivery note, picking list, import summary, receiving report) + CSV/PDF export — operational necessity, not optional polish
- [ ] Dashboard KPIs computed from real data — closes out the "manually maintained rows" anti-pattern already flagged in CONCERNS.md

### Add After Validation (v1.x — next milestone)

- [ ] Full lot-level traceability report (import → lot → sale) — trigger: once lot/batch data has been live long enough to validate accuracy
- [ ] Landed cost per SKU/bottle/carton with defined cost-allocation method — trigger: once finance confirms the allocation method (proportional by value/weight/unit) they actually want
- [ ] Compliance readiness gate/flagging UI — trigger: once compliance fields have real data flowing in to flag against

### Future Consideration (v2+)

- [ ] Multi-level approval chains — defer until org structure/order volume actually demands more than one approval tier
- [ ] 8-role granular structure — defer until org actually grows into needing role separation beyond the 6 basic roles
- [ ] Third-party auth / SSO — defer unless external partner/customer access or compliance mandate requires it
- [ ] Real-time push updates (websockets) — defer unless users report refresh-based staleness is an actual operational problem

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Authentication | HIGH | MEDIUM | P1 |
| RBAC + backend permission enforcement | HIGH | MEDIUM-HIGH | P1 |
| Audit logging | HIGH | MEDIUM | P1 |
| Backend license/stock/credit/discount enforcement | HIGH | MEDIUM | P1 |
| Lot/batch stock control | HIGH | HIGH | P1 |
| Approval workflow (single-level, no self-approval) | HIGH | MEDIUM | P1 |
| Liquor tax/compliance core fields | HIGH | MEDIUM-HIGH | P1 |
| Documents (invoice/picking/receiving) + export | HIGH | MEDIUM | P1 |
| Dashboard KPIs from real data | MEDIUM | LOW-MEDIUM | P1 |
| Full lot traceability report | MEDIUM | MEDIUM | P2 |
| Landed cost per SKU/unit | MEDIUM | MEDIUM-HIGH | P2 |
| Compliance readiness gate | MEDIUM | LOW-MEDIUM | P2 |
| Multi-level approval chains | LOW (now) | HIGH | P3 |
| 8-role structure split | LOW (now) | MEDIUM | P3 |
| Third-party auth/SSO | LOW | MEDIUM | P3 |
| Real-time push updates | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for this milestone (production-readiness cannot be claimed without it)
- P2: Should have, natural next milestone once P1 data models are live and validated
- P3: Nice to have, explicitly deferred per project scope

## Competitor / Domain-Pattern Analysis

No direct competitor products were evaluated (internal system, not a market-facing SaaS comparison). Instead, findings are benchmarked against general ERP/distribution-software domain conventions:

| Feature | Typical ERP/Distribution Convention | This Project's Approach |
|---------|--------------------------------------|--------------------------|
| RBAC | Role-permission join tables (not roles hardcoded on user), multi-role support, backend-enforced (confirmed convention via web research) | Matches: `users`/`roles`/`user_roles`/`permissions`/`role_permissions`, multi-role per user |
| Lot/batch tracking | Lot/batch as system of record for regulated/traceable goods, linked to inventory + quality + compliance data end-to-end | Matches: `InventoryStock` as source of truth, product-level quantity derived; traceability from import to sale is the differentiator payoff |
| Approval workflow | Status-driven workflow that locks affected records during pending approval to prevent conflicting updates, full audit trail of decision | Matches: DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED status machine; orders in non-final states don't affect stock/delivery |
| Audit trail | Data ownership + audit trail + retention rules as a baseline expectation for regulated inventory systems | Matches: user/timestamp/action/entity/before-after value, append-only |

## Sources

- `C:\Users\KuMo\Documents\GitHub\Storage_Demo\.planning\PROJECT.md` — authoritative milestone scope, constraints, decisions (HIGH confidence, primary source)
- `C:\Users\KuMo\Documents\GitHub\Storage_Demo\liquor-system-improvement-advice.md` — authoritative feature requirements + acceptance criteria for all 6 areas (HIGH confidence, primary source per PROJECT.md instruction to treat as authoritative)
- `C:\Users\KuMo\Documents\GitHub\Storage_Demo\liquor-system-basic-role-permission-recommendation.md` — authoritative role/permission structure and matrix (HIGH confidence, primary source)
- [Batch Manufacturing ERP Software - Top FAQs for 2026 (Datacor)](https://www.datacor.com/resources/batch-manufacturing-erp-faqs) — MEDIUM confidence, corroborates EBR/traceability/audit-trail conventions
- [Distribution ERP Systems for Lot Tracking and Inventory Traceability (SysgenPro)](https://sysgenpro.com/erp/distribution-erp-systems-that-improve-lot-tracking-and-inventory-traceability) — MEDIUM confidence, corroborates lot-tracking-as-source-of-truth convention
- [Role-Based Access Control Best Practices for 2026 (TechPrescient)](https://www.techprescient.com/blogs/role-based-access-control-best-practices/) — MEDIUM confidence, corroborates role-by-job-function and backend enforcement conventions
- [Business Central Approval Workflows for Field Service (Sandlapper Dynamics)](https://www.sandlapperdynamics.com/post/business-central-approval-workflows-field-service) — MEDIUM confidence, corroborates status-locking-during-approval pattern
- [How Lot Traceability ERP Connects Warehouse, Production, and Customer Delivery (Softengine)](https://softengine.com/blog-lot-traceability-erp-warehouse-production-delivery/) — MEDIUM confidence, corroborates end-to-end lot traceability value proposition
- `C:\Users\KuMo\Documents\GitHub\Storage_Demo\.planning\codebase\CONCERNS.md` (referenced in PROJECT.md, not directly read this pass) — noted as independently corroborating the same gaps (no auth, no tests, no logging, stock-sync inconsistencies)

---
*Feature research for: Liquor import/sales/distribution production-readiness milestone (RBAC, audit, lot/batch inventory, approval workflow, tax/compliance, documents/reporting)*
*Researched: 2026-09-03*
