# Project Research Summary

**Project:** Storage Demo — Production Readiness (Auth/RBAC, Audit Log, Approval, Lot Control, Documents)
**Domain:** Liquor import/sales/distribution ERP — hardening an existing brownfield system to production readiness
**Researched:** 2026-09-03
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone retrofits six tightly-coupled production-readiness capabilities — custom authentication, RBAC, audit logging, lot/batch inventory control, single-level approval workflow, and liquor tax/compliance data — onto an existing Express 4.21 / Prisma 6.4 / MySQL + React 19 / Vite system that currently has none of them. All four research passes converge on the same conclusion: this is not a framework or architecture problem, it's a **discipline and sequencing problem**. The existing layered Route → Controller → Model/Prisma pattern is sound and extends cleanly; the real risk is retrofitting these features in the wrong order, or as isolated additions that don't account for how they interact with each other (e.g., approval status and stock deduction timing, or self-approval checks that only exist in the UI).

The recommended approach is hand-rolled, dependency-light, and matches the existing codebase's conventions rather than reaching for frameworks: Argon2id password hashing + short-lived JWT access token + DB-backed opaque refresh token (not express-session, not Passport, not third-party auth); a flat permission-code RBAC model checked via requirePermission(code) middleware (not casl/accesscontrol); explicit service-layer audit logging calls (not solely relying on automatic Prisma Client Extensions, since APPROVE/LOGIN/EXPORT aren't generic CRUD); a plain lookup-table status machine for approval (not a workflow engine like XState); and pdfkit/csv-stringify for documents (not Puppeteer). Business rules (license, stock, credit, discount, approval transitions) belong in the Model layer inside prisma.$transaction() blocks — never in controllers — because that is both the existing convention and the only place these checks can't be bypassed by direct API calls.

The dominant risk, confirmed independently by all four research passes, is **partial or sequence-broken enforcement**: self-approval blocked in the UI but not the API; audit logging that covers CRUD but misses login/approve/export; lot-level stock control that fixes today's product/lot desync but reintroduces it when approval is added later and stock deduction timing isn't revisited; and financial/tax calculations that compound the codebase's existing Decimal-precision bug. None of these are architecturally hard problems — they are checklist items that get silently skipped when features are built independently instead of as one coordinated enforcement layer. The roadmap should treat "backend enforces regardless of caller" as the acceptance bar for every phase, not just the auth phase, and should explicitly re-visit earlier phases' wiring (especially stock deduction) when later phases (approval) land.

## Key Findings

### Recommended Stack

Auth/RBAC/audit are built with minimal, mature dependencies rather than heavyweight frameworks, since this is a from-scratch, custom (no third-party IdP) auth build with a small, flat permission model (6 roles). See .planning/research/STACK.md for full detail including versions and installation commands.

**Core technologies:**
- argon2 (native binding, 0.45.1) — password hashing; OWASP-current default (Argon2id), no legacy-hash migration cost since this is greenfield
- jsonwebtoken (9.0.3) + opaque DB-backed refresh token in httpOnly/Secure/SameSite=Strict cookie — access/refresh token architecture; enables revocation (a plain JWT cannot be revoked) and satisfies "immediate deactivation" requirement
- Custom Express middleware (requireAuth, requirePermission(code)) — no RBAC library; a flat role_permissions join-table lookup is sufficient at this scale (6 roles, one ownership rule)
- Prisma Client Extensions ($extends, not deprecated $use) + explicit service-layer AuditLogModel.record() calls — hybrid audit capture; extensions alone can't distinguish APPROVE from generic UPDATE or capture non-CRUD events (LOGIN, EXPORT)
- pdfkit (0.20.2) + csv-stringify (6.8.3) — structured document generation (invoices, picking lists, reports); 10-30x lighter/faster than Puppeteer for fixed-layout business documents
- helmet, express-rate-limit, zod — recommended hardening additions (secure headers, login brute-force protection, request validation) flagged as fast-follow given known gaps in CONCERNS.md

### Expected Features

The two project source documents (liquor-system-improvement-advice.md, liquor-system-basic-role-permission-recommendation.md) function as an authoritative requirements spec, cross-checked against general ERP/distribution domain conventions with no contradictions found. See .planning/research/FEATURES.md for full detail, dependency graph, and prioritization matrix.

**Must have (table stakes) — all required together for "production ready," no smaller MVP within this milestone:**
- Authentication (login) and RBAC (6 roles, multi-role support, backend-enforced permissions)
- Audit logging (create/update/delete/approve/reject/login/export — append-only)
- Backend enforcement of license/stock/credit/discount rules (the stated Core Value of this milestone)
- Lot/batch stock control (InventoryStock as source of truth, no oversell)
- Approval workflow (status machine, no self-approval, threshold-triggered approval)
- Liquor tax/compliance core fields (HS code, excise, ABV, landed cost inputs)
- Core trade documents + CSV/PDF export; dashboard KPIs computed from real data

**Should have (differentiators, v1.x/next milestone):**
- Full lot-level traceability report (import → lot → sale)
- Landed cost per SKU/bottle/carton with a defined cost-allocation method
- Compliance readiness gate/flagging UI for legacy data gaps

**Defer (v2+, explicitly out of scope):**
- Multi-level approval chains, 8-role granular structure, third-party auth/SSO, real-time (websocket) updates, automated CI/CD as part of this milestone

### Architecture Approach

The four new capability areas are cross-cutting additions layered into the existing three-layer backend (Route → Controller → Model/Prisma), not parallel systems. A new middleware chain (authenticate → attachUser → requirePermission(code)) runs before existing routes; business rules and state transitions live in the Model layer inside prisma.$transaction() blocks (never in controllers); a new InventoryStockModel becomes the sole owner of lot-level quantity truth, with Product.stockQuantity always derived/recomputed, never independently written. See .planning/research/ARCHITECTURE.md for full component map, file structure, and data-flow diagrams.

**Major components:**
1. middleware/auth.ts + middleware/permissions.ts — authenticate (who) vs. authorize (what), split per best practice; permissions re-derived from DB every request (JWT carries only userId, never embeds roles/permissions, to support immediate deactivation)
2. InventoryStockModel (new) — lot decrement/restore/rollup logic, called by SalesOrderModel/ImportOrderModel inside shared transactions, never bypassed by a second write path
3. approval.model.ts (new, plain helper not a table/engine) — a {from, to, requiredPermission} transition lookup + guardSelfApproval() check, deliberately not a workflow engine (XState) given single-level scope
4. AuditLogModel (new) — create()/findAll() only, no update/delete route ever registered, written inside the same transaction as the business mutation it audits

### Critical Pitfalls

Full list of 10 critical pitfalls with prevention/verification steps in .planning/research/PITFALLS.md. Top ones with cross-phase implications:

1. **Big-bang auth cutover breaks every existing CRUD flow at once** — roll out in layers (issue token → wire frontend client → enforce 401 → enforce 403 route-by-route → gate UI), don't flip enforcement in one PR; fix the existing silent-error-swallowing bug in useResource at the same time or breakage will be invisible.
2. **No-self-approval enforced only in the UI, not the approve endpoint** — must explicitly compare order.createdBy vs req.user.id server-side; RBAC permission checks alone cannot express this data-dependent rule, and multi-role users make UI-only hiding trivially bypassable.
3. **Audit log incomplete or mutable** — approve/reject/login/export are not generic CRUD and are easy to leave unaudited if logging is only bolted onto a shared update() method; no PUT/DELETE route should ever be registered for the audit table.
4. **Lot/batch source-of-truth still desyncs** — this project already has this exact failure mode (StockTransaction created, products.stockQty not updated); fix requires one centralized applyStockMovement() function used by every write path (receive/sale/edit/delete/cancel/return), not independent per-path arithmetic.
5. **Approval status machine and lot/batch stock deduction built in separate phases without revisiting the interaction** — if stock decrements on order-create (built in the lot/batch phase) and approval is added later without moving the deduction trigger to the APPROVED transition, pending/rejected orders permanently consume stock. This is a known cross-phase rework risk that the roadmap must plan for explicitly.

## Implications for Roadmap

Based on the dependency graph in FEATURES.md and architecture/pitfalls findings, all research converges on the same phase ordering: **Auth → RBAC/Audit → Backend Enforcement + Lot/Batch (co-designed) → Approval Workflow (revisits lot/batch stock trigger) → Tax/Compliance Data → Documents & Reporting (last, depends on everything)**.

### Phase 1: Authentication
**Rationale:** Every other feature needs a known user to attribute actions to, check permissions against, or restrict access for — foundational per all four research files.
**Delivers:** Login/logout, JWT access token + DB-backed refresh token, req.user population, frontend AuthProvider + client token wiring.
**Addresses:** Table-stakes "Authentication" feature.
**Avoids:** Pitfall 1 (big-bang cutover) — must be staged: issue tokens without enforcement first, then wire frontend, then enforce 401 globally, then 403 per-route.

### Phase 2: RBAC + Audit Logging
**Rationale:** RBAC requires identity (Phase 1); audit logging requires identity and should land alongside RBAC since permission changes themselves need auditing, and the audit infrastructure (append-only table, explicit service calls) is a prerequisite for every subsequent phase's compliance requirements.
**Delivers:** users/roles/user_roles/permissions/role_permissions schema, requirePermission(code) middleware, AuditLog model (create/findAll only, no write/delete route), explicit audit calls wired into login.
**Addresses:** RBAC with 6 roles + multi-role support, backend permission enforcement, audit logging (login coverage at minimum).
**Avoids:** Pitfall 2 (hardcoded role-string checks — build the permission-code lookup, not role === 'ADMIN'), Pitfall 4 (mutable/incomplete audit log — no PUT/DELETE route ever registered).

### Phase 3: Backend Business Rule Enforcement + Lot/Batch Stock Control
**Rationale:** These are co-designed per FEATURES.md — "no overselling" cannot be correctly enforced until stock is tracked at the lot level, and lot-level tracking is pointless without an enforcement layer checking it before order confirmation.
**Delivers:** InventoryStockModel (single source of truth for lot quantity, centralized applyStockMovement() used by every write path), license/credit/discount validation inside transactions, no-self-approval groundwork wired at the earliest approve-adjacent endpoint.
**Uses:** Transactional prisma.$transaction() pattern with row-locking (SELECT ... FOR UPDATE) for race-condition safety.
**Avoids:** Pitfall 5 (lot/product stock desync — this codebase already has this exact bug per CONCERNS.md), Pitfall 7 (credit/stock race conditions under concurrency), Pitfall 8 (Decimal precision — fix as a prerequisite here since discount/credit math is affected too).

### Phase 4: Approval Workflow
**Rationale:** Depends on RBAC (needs a real Approver permission) and Authentication (needs createdBy vs approvedBy comparison); must explicitly revisit the stock-deduction trigger point built in Phase 3.
**Delivers:** Status machine (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED) with an explicit transition-guard map, assertNotSelfApproval() check, threshold-triggered auto-routing to approval, stock deduction moved to fire on the APPROVED transition (not order-create) for orders requiring approval.
**Implements:** approval.model.ts shared helper pattern (lookup table + guard, not a workflow engine).
**Avoids:** Pitfall 3 (self-approval bypass via API for multi-role users), Pitfall 6 (illegal transitions / stock consumed before approval) — this is the highest-risk cross-phase rework point identified across all four research files and should be flagged prominently in phase planning.

### Phase 5: Liquor Tax & Compliance Data
**Rationale:** Mostly schema-independent (additive fields on Product/ImportOrder), but its value (landed cost, tax invoices) isn't realized until Documents & Reporting consumes it; sequencing it just before that phase is sound per FEATURES.md.
**Delivers:** HS code, excise category, ABV, package size, origin country, customs/excise/VAT/landed-cost fields; a "ready for sale" completeness gate (not schema-only) with a legacy-data compliance-gap report.
**Avoids:** Pitfall 9 (compliance fields present as nullable metadata but never enforced — must ship the gate in the same phase as the schema, not split across phases).

### Phase 6: Documents & Reporting
**Rationale:** Downstream of everything — invoices need tax fields (Phase 5), picking lists need lot data (Phase 3), status displays need the real approval state machine (Phase 4).
**Delivers:** PDF/CSV export (pdfkit/csv-stringify), standard trade documents (invoice, tax invoice, delivery note, picking list, import summary, receiving report), dashboard KPIs computed from real DB aggregates (closing out the manually-maintained-KPI anti-pattern).
**Avoids:** Pitfall 10 (reports built on unpaginated findAll()-style queries that silently under-report or time out) — must use purpose-built SQL-level aggregation with indexes added as part of this phase, not deferred.

### Phase Ordering Rationale

- Dependency graph (FEATURES.md) and architecture (ARCHITECTURE.md) independently converge on the same order: everything requires Authentication first; RBAC and Audit are natural companions since both need identity and audit itself needs to cover permission changes; Backend Enforcement and Lot/Batch are co-designed as one enforcement layer; Approval depends on RBAC + Auth and must explicitly rewire Phase 3's stock-deduction trigger; Tax/Compliance is schema-independent but its payoff is realized in Documents; Documents is correctly last since it's downstream of all prior data models.
- This grouping avoids the two riskiest cross-phase pitfalls identified: (1) big-bang auth rollout breaking silent-failure-prone existing flows, and (2) approval workflow silently failing to move the stock-deduction trigger point that lot/batch control established earlier — both are explicitly flagged as requiring the *next* phase to revisit the *previous* phase's wiring, not just add new code.
- Financial/Decimal precision fixes (Pitfall 8) are pulled forward into Phase 3 rather than deferred to Phase 5, since credit/discount math in backend enforcement already exercises the same bug class.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 4 (Approval Workflow):** The stock-deduction-trigger rewiring interaction with Phase 3 is the single highest cross-phase risk identified across all four research files; worth a focused /gsd-research-phase pass to design the two-stage reserve-then-commit model explicitly before implementation.
- **Phase 5 (Tax/Compliance):** Landed-cost allocation methodology (proportional by value/weight/unit across shared freight/insurance costs) is explicitly flagged as undecided pending finance stakeholder input — needs a decision point before or during planning, not just research.
- **Phase 3 (Decimal/financial precision fix):** Choosing and validating a fixed-point library (e.g., decimal.js) and a single rounding policy is a design decision with compliance implications (must reconcile with tax authority calculations) — worth explicit research/spike before broad implementation.

Phases with standard patterns (skip research-phase, patterns already well-documented in this research):
- **Phase 1 (Authentication):** Argon2id + JWT/refresh-token architecture is a well-established, fully-specified pattern (see STACK.md and ARCHITECTURE.md code examples).
- **Phase 2 (RBAC + Audit):** Flat permission-code middleware and append-only audit log are directly specified with working code examples in ARCHITECTURE.md.
- **Phase 6 (Documents & Reporting):** pdfkit/csv-stringify usage patterns are standard and well-documented; the main risk (unpaginated queries) is a known, well-understood fix (SQL aggregation + indexes), not a research gap.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Package versions verified live against npm registry (HIGH); security/architecture guidance (Argon2 vs bcrypt, JWT patterns) drawn from MEDIUM-confidence secondary sources cross-checked against OWASP-aligned consensus. Prisma $use deprecation status flagged as not independently re-verified against live 6.4 docs — verify before implementation. |
| Features | MEDIUM-HIGH | Two project source documents treated as authoritative primary requirements (HIGH); general ERP/lot-tracking/RBAC domain conventions corroborated via MEDIUM-confidence web sources with no contradictions found. |
| Architecture | HIGH | Patterns verified directly against existing codebase conventions (.planning/codebase/ARCHITECTURE.md, STRUCTURE.md) plus current Prisma Client Extensions documentation and RBAC middleware best-practice sources. |
| Pitfalls | MEDIUM-HIGH | Grounded directly in this repo's own CONCERNS.md and schema inspection for codebase-specific pitfalls (HIGH); general retrofit/RBAC/liquor-tax pitfalls corroborated via multiple MEDIUM-confidence 2025-2026 sources. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Prisma $use middleware removal status:** STACK.md flags this as not independently re-verified against live Prisma 6.4 docs in this research pass — confirm before committing to $extends-only audit implementation (low risk either way, since $extends is the correct forward-looking choice regardless).
- **Landed-cost allocation methodology:** No defined method (proportional by value/weight/unit) for splitting shared freight/insurance costs across SKUs in one import order — flagged in FEATURES.md as a "trigger" condition requiring finance stakeholder input before Phase 5 work on this specific differentiator begins. Core compliance fields (HS code, excise, ABV) are unaffected and can proceed without this decision.
- **Excel (.xlsx) export need:** exceljs is flagged as a possible fast-follow (not explicitly requested by PROJECT.md) if Finance/Accounting stakeholders need pivotable spreadsheets beyond CSV — confirm during Phase 6 planning whether this is in scope or genuinely deferred.
- **Rounding policy for financial calculations:** No single rounding rule (round-half-up vs banker's, and at which calculation step) has been defined yet — this is a design decision, not a research gap, but must be resolved and documented before Phase 3/5 financial code is written, with reference-value tests to validate against.

## Sources

### Primary (HIGH confidence)
- .planning/PROJECT.md — authoritative milestone scope, constraints, decisions
- liquor-system-improvement-advice.md — authoritative feature requirements + acceptance criteria for all 6 areas
- liquor-system-basic-role-permission-recommendation.md — authoritative role/permission structure and matrix
- .planning/codebase/CONCERNS.md, .planning/codebase/ARCHITECTURE.md, .planning/codebase/STRUCTURE.md — existing codebase patterns and known gaps
- Live npm view registry queries for all recommended packages (argon2, jsonwebtoken, pdfkit, csv-stringify, helmet, zod, etc.), verified 2026-09-03
- Prisma Client Extensions documentation (prisma.io/docs/orm/prisma-client/client-extensions)

### Secondary (MEDIUM confidence)
- OWASP-aligned Argon2 vs Bcrypt vs Scrypt vs PBKDF2 guide (2026) — guptadeepak.com
- Node.js PDF Generation: PDFKit vs Puppeteer vs jsPDF Comparison — reintech.io
- Role-Based Access Control (RBAC) in Node.js, 2026 — blog.dhirajroy.com
- Prisma discussion #25043 — auditExtension interactive-transaction caveat (github.com/prisma/prisma)
- 10 RBAC Best Practices You Should Know in 2025 — Oso (osohq.com)
- Distribution ERP Systems for Lot Tracking and Inventory Traceability — SysgenPro (sysgenpro.com)

### Tertiary (LOW confidence)
- General software engineering training-data knowledge on status-machine/transition-guard patterns, transactional row-locking, and fixed-point arithmetic best practices (cited in PITFALLS.md, not independently corroborated in this pass)

---
*Research completed: 2026-09-03*
*Ready for roadmap: yes*
