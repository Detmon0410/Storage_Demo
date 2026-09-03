# Storage Demo — Production Readiness

## What This Is

A liquor import, sales, and distribution system (pnpm monorepo: Express/Prisma/MySQL backend, React/Vite frontend) currently at demo/early-MVP maturity — it records products, imports, stock, licenses, customers, and sales orders, but has no authentication, no backend rule enforcement, and no lot/batch-level stock control. This milestone hardens it into a production-ready system for internal liquor trading operations.

## Core Value

The system must prevent invalid business actions (selling without a valid license, overselling stock, bypassing approval) at the backend — not just hide buttons in the UI.

## Requirements

### Validated

- ✓ Product/category/supplier/customer CRUD — existing
- ✓ Import order → auto-generated stock-in transactions — existing
- ✓ Sales order creation flow — existing
- ✓ License and customer-license tracking — existing
- ✓ i18n (multi-language UI) — existing
- ✓ Dashboard KPI display (currently manually maintained) — existing

### Active

- [ ] Authentication: users must log in before accessing the system
- [ ] RBAC: 6 roles (System Admin, Manager/Approver, Import & Compliance Officer, Warehouse & Distribution Officer, Sales Officer, Finance/Accounting Officer) per `liquor-system-basic-role-permission-recommendation.md`, with `users`/`roles`/`user_roles`/`permissions`/`role_permissions` schema and support for multiple roles per user
- [ ] Audit logging: create/update/delete/approve/reject/login/export actions recorded with user, timestamp, entity, before/after value
- [ ] Backend enforcement of license validity, stock availability, credit limit, and discount-limit rules on sales orders (not frontend-only)
- [ ] Lot/batch stock control: `InventoryStock` becomes source of truth; sales orders decrement the selected lot; product-level stock derived/synced from lots; prevent overselling a lot
- [ ] Approval workflow: replace free-text `approver` field with real status machine (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED), no self-approval, approver/timestamp/reason recorded, auto-require approval above credit/discount thresholds
- [ ] Liquor tax/compliance data: HS code, excise category, alcohol type, ABV, package size, bottle/carton conversion, origin country on products; customs duty/excise/VAT/freight/insurance/landed cost on import orders; stamp quantity calculation; permit/customs/excise document references
- [ ] Documents & reporting: sales invoice, tax invoice, delivery note, picking list, import summary, receiving report; CSV/PDF export; dashboard KPIs computed from real data instead of manually maintained rows

### Out of Scope

- Multi-level (>1 tier) approval chains — future roles/expansion noted in role doc, not this milestone
- Splitting the 6 basic roles into the 8-role detailed structure — deferred until org actually needs it
- Third-party auth providers (Auth0/Supabase/etc.) — custom auth per existing codebase pattern
- Automated CI/CD pipeline setup — not requested, codebase currently has none

## Context

- Brownfield codebase, mapped at `.planning/codebase/` (STACK, ARCHITECTURE, STRUCTURE, CONVENTIONS, TESTING, INTEGRATIONS, CONCERNS)
- Two source docs define this milestone's scope in full detail — treat as authoritative requirements, not just inspiration:
  - `liquor-system-improvement-advice.md` — 6 prioritized areas with requirements + acceptance criteria + suggested build order
  - `liquor-system-basic-role-permission-recommendation.md` — role definitions, DB schema, permission matrix, enforcement rules
- `.planning/codebase/CONCERNS.md` independently flagged the same gaps (no auth, no tests, no logging, no rate limiting, stock-sync inconsistencies) — corroborates the improvement-advice priorities
- Suggested implementation order (from improvement-advice.md, user-confirmed): auth/roles/audit → backend rule enforcement → lot/batch stock control → approval workflow → tax/compliance data → documents/reporting

## Constraints

- **Tech stack**: Must build on existing Express + Prisma (MySQL) backend and React + Vite frontend — no framework swap
- **Backend-first enforcement**: Every business rule (license, stock, credit, discount, approval) must be enforced server-side; frontend may additionally hide UI but is never the sole gate
- **No self-approval**: A user cannot approve their own created/edited transaction, regardless of role combination
- **Schema evolution**: RBAC and audit tables are additive to the existing Prisma schema — must not break existing CRUD flows for products/orders/customers/etc.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Adopt 6-role structure as-is from role doc | Simpler than 8-role example; sufficient for current org size; DB schema supports future splitting | — Pending |
| Cover all 6 improvement areas in this milestone, in the doc's suggested order | Docs already define acceptance criteria; auth/audit must land first since every later phase depends on knowing "who did this" | — Pending |
| Custom auth (no third-party provider) | Matches existing codebase pattern (no auth libs currently integrated); avoids new external dependency | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-09-03 after initialization*
