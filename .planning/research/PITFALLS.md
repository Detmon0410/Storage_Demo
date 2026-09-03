# Pitfalls Research

**Domain:** Retrofitting auth/RBAC, audit logging, lot/batch inventory, approval workflow, and liquor tax/compliance data onto an existing production liquor import-sales system
**Researched:** 2026-09-03
**Confidence:** MEDIUM-HIGH (grounded in direct codebase inspection of this repo's CONCERNS.md and schema; general retrofit/RBAC pitfalls verified against multiple 2025-2026 sources; liquor-tax-specific pitfalls verified against alcohol-compliance vendor documentation and cross-checked against this project's own compliance requirements doc)

## Critical Pitfalls

### Pitfall 1: Big-bang auth cutover breaks every existing CRUD flow at once

**What goes wrong:**
Auth/RBAC is added by wrapping every route with `requireAuth` + `requirePermission` in one PR, then discovering that dozens of existing frontend calls (products, imports, customers, licenses — all currently open, per `apps/backend/src/routes/index.ts`) 401/403 immediately because the frontend has no login flow, token storage, or permission-aware UI yet. Demo data, seed scripts, and any external tooling that hit the API directly also break.

**Why it happens:**
The system was built with zero auth for a year+; there's no existing pattern (session cookie, token header) to extend — this is a from-scratch auth introduction, not an upgrade. Teams treat "add auth" as one commit instead of a staged rollout (issue token → attach to frontend client → enforce on read routes → enforce on write routes → enforce on destructive routes).

**How to avoid:**
Roll out in layers: (1) add login + JWT issuance + `req.user` population without enforcement (audit-only/log-only mode), (2) update frontend API client to attach token to every request, (3) enforce auth (401) globally, (4) enforce permission checks (403) route-by-route starting with destructive/sensitive endpoints, (5) turn on RBAC UI gating last. Keep seed script and dev scripts updated to create a default admin user + login at each stage.

**Warning signs:**
Frontend `useResource` hooks silently swallowing errors (already flagged in CONCERNS.md) means a broken auth rollout will look like "data just doesn't load" with no visible error — a major detection risk. Fix the silent-error-swallowing bug before or alongside the auth rollout, or the team will not notice breakage until manual QA.

**Phase to address:** Auth/RBAC/audit phase (Phase 1 per suggested order). Explicitly sequence: token issuance → client wiring → route enforcement, not one atomic switch.

---

### Pitfall 2: Retrofitted RBAC role/permission model becomes stale or over-broad ("role explosion" in reverse — too coarse)

**What goes wrong:**
Because there was no prior access model, the first cut of permissions tends to be either too coarse (e.g., "Sales Officer can do everything in Sales module including delete/void") or hardcoded role checks scattered through controllers (`if (user.role === 'ADMIN')`) instead of centralized permission checks against the `role_permissions` table. Six months later, adding a 7th role or splitting an existing one (explicitly anticipated in the role doc's "Future Expansion" section) requires touching every controller.

**Why it happens:**
Fastest path to "it works" is inline role-name string comparisons rather than querying `permissions`/`role_permissions`. Teams under time pressure skip the permission-abstraction layer and hardcode role checks, matching this project's own pattern of "large controllers with mixed concerns" already flagged in CONCERNS.md.

**How to avoid:**
Build a single `hasPermission(user, permissionCode)` helper (or middleware factory `requirePermission('SALES_ORDER_APPROVE')`) from day one and never compare role names directly in business logic. Seed `permissions` with fine-grained, resource+action codes (`SALES_ORDER:CREATE`, `SALES_ORDER:APPROVE`, `IMPORT_ORDER:APPROVE`) matching the permission matrix in the role doc, not coarse module-level flags. This is directly actionable since the role doc already supplies the matrix — implement it as data, not code branches.

**Warning signs:** Grep for `role ===` or `role.includes(` in controllers; any hit is a hardcoded-role smell that will need rework when roles split.

**Phase to address:** Auth/RBAC phase. Verify by code review: no direct role-string comparisons outside the auth/permission module itself.

---

### Pitfall 3: No-self-approval rule enforced only in UI, not in the approval endpoint

**What goes wrong:**
The "Manager/Approver" role reviews and approves orders. If the same person also holds another role that created the order (multi-role users are explicitly supported per PROJECT.md), or if the approve endpoint only checks "does this user have APPROVE permission" without checking "is this user the creator," a user can self-approve by calling the API directly, even though the button is hidden in the UI.

**Why it happens:**
Self-approval prevention is a business rule, not a permission — RBAC systems check "can this role do X" not "can this specific user do X to this specific record." Teams that model authorization purely as role-based permission checks miss row-level/relationship checks entirely, then rely on frontend button-hiding, which the improvement-advice doc explicitly warns against ("frontend may hide buttons, but backend must always check").

**How to avoid:**
In the approve/reject controller, explicitly compare `order.createdBy` (and ideally `order.lastModifiedBy`) against `req.user.id` and reject with 403 if they match, regardless of role/permission. Write this as a dedicated, unit-testable rule (`assertNotSelfApproval(order, actingUser)`) separate from the generic permission middleware, since it's a data-dependent rule the generic RBAC layer cannot express.

**Warning signs:** No test exists today asserting self-approval is blocked (CONCERNS.md confirms zero test coverage). Absence of any test named `*self-approval*` or `*self-approve*` after the approval workflow phase is a red flag.

**Phase to address:** Approval workflow phase, but the check must be added at the same time permission checks are added in the auth phase for import/sales order approve endpoints — don't defer it, since "approve" endpoints will exist (even if primitive, via the old free-text `approver` field) before the full status-machine workflow lands.

---

### Pitfall 4: Audit log itself is mutable, incomplete, or not actually queried before deletion/edit

**What goes wrong:**
Teams add an `AuditLog` table and log create/update actions, but (a) allow authenticated admins to edit/delete rows in it through normal Prisma CRUD routes (violating the explicit requirement "audit logs cannot be edited through normal application screens"), (b) only log the action name without before/after values, making the log useless for "what changed," or (c) forget to log actions that don't go through a generic "update" path — like the approve/reject decision, login attempts, or CSV/PDF exports — because those don't look like typical CRUD.

**Why it happens:**
It's easy to bolt audit logging onto the generic CRUD service layer (log every `update()` call) and think you're done, but approve/reject/login/export are not modeled as generic CRUD in most codebases — they're distinct controller actions that need explicit audit calls. Also, no route protects the audit table itself once it exists, because it looks like just another Prisma model.

**How to avoid:**
Treat `AuditLog` as write-once, append-only at the database/permission layer: no PUT/DELETE route registered for it at all (not just permission-gated — physically absent from the router), and no Prisma model method exposed beyond `create`/`findMany`. Build audit logging as a cross-cutting middleware/service called explicitly from every sensitive action (including login, approve, reject, export) — not only from the generic model-update path. Store `before`/`after` as JSON snapshots, not just a change description string.

**Warning signs:** If audit logging is implemented only inside a shared `BaseModel.update()`, check whether approve/reject/login/export controllers call it explicitly — if they route around the base model (likely, since approval is a distinct workflow), they'll be silently unaudited.

**Phase to address:** Auth/RBAC/audit phase for the log-writing infrastructure and immutability; but each subsequent phase (approval workflow, lot/batch stock, tax/compliance data entry, documents/export) must explicitly wire in audit calls for its new actions — this is a recurring cross-phase checklist item, not a one-time task.

---

### Pitfall 5: Lot/batch becomes source of truth in the data model but product-level stock desyncs anyway

**What goes wrong:**
This project already has the exact failure mode described in CONCERNS.md: `StockTransaction` records are created but `products.stockQty` is not automatically updated, so inventory accuracy can't be trusted. Migrating to lot/batch as source of truth without fixing the underlying "who updates aggregate stock, and when" problem just moves the desync one level deeper: `InventoryStock.quantityOnHand` per lot can now also drift from the sum of `StockTransaction` movements for that lot, and product-level stock (derived/synced from lots per PROJECT.md) can drift from the sum of lots.

**Why it happens:**
Stock quantity updates are scattered across multiple write paths (import receiving, sales order create, sales order edit, sales order delete/cancel, returns, damage/adjustment) and each path is tempting to hand-code independently ("subtract quantity here, add back there") rather than centralizing through one transactional stock-movement function. Any path that's missed (especially edit/delete/cancel — explicitly called out as needing "restore previous lot quantity before applying new quantity") causes drift that's invisible until a physical stock count disagrees with the system.

**How to avoid:**
Implement a single `applyStockMovement(lotId, delta, referenceDoc, movementType)` function used by every write path (receiving, sale, sale-edit, sale-cancel, return, adjustment) inside a DB transaction that also writes the `StockTransaction` audit row and recalculates the product aggregate in the same transaction — never have two code paths independently mutate `InventoryStock.quantityOnHand`. Add a reconciliation job/report (sum of StockTransactions for a lot vs. current `quantityOnHand`) as a build-time acceptance check, not just a nice-to-have report.

**Warning signs:** Any code path that does `quantityOnHand = quantityOnHand + x` inline in a controller rather than calling the shared movement function. Sales order edit/delete flows are the highest-risk spot — CONCERNS.md and improvement-advice.md both flag this specifically ("when a sales order is deleted or edited, the previous lot quantity is restored before applying the new quantity") because it's the easiest to get backwards (double-decrement or double-restore).

**Phase to address:** Lot/batch stock control phase. Verification: write tests for create→edit→delete lifecycle of a sales order and assert lot quantity returns to its original value after delete, and after an edit that changes quantity or changes lot.

---

### Pitfall 6: Approval status machine allows illegal transitions or lets non-approved orders still consume stock

**What goes wrong:**
CONCERNS.md already documents this exact bug class in the existing import order workflow: no status machine, so status can "jump from STAGING to PENDING_APPROVAL backwards" or get stuck unreachable. When approval statuses (DRAFT/PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED) are bolted onto sales/import orders without a transition guard, two things go wrong: (a) invalid transitions (APPROVED → DRAFT, REJECTED → APPROVED without re-submission) become possible via direct API calls, and (b) stock is decremented at order-creation time regardless of approval status, so a still-pending or later-rejected order has already reserved/consumed lot stock — violating the explicit requirement that orders requiring approval "must not affect final stock or delivery until approved."

**Why it happens:**
Status is often modeled as a plain string/enum field updated by whichever endpoint touches the record, with no central transition table. Stock deduction logic (built in the earlier lot/batch phase) is typically wired to "on order create," and nobody revisits that wiring when approval is added later — the two features are built in different phases (per the suggested order: lot/batch is phase 3, approval is phase 4) so the interaction is easy to miss.

**How to avoid:**
Define an explicit allowed-transitions map (`{DRAFT: [PENDING_APPROVAL, CANCELLED], PENDING_APPROVAL: [APPROVED, REJECTED, CANCELLED], APPROVED: [CANCELLED], REJECTED: [DRAFT], CANCELLED: []}`) and reject any transition not in the map, server-side, regardless of role. Change stock-deduction trigger point explicitly when building the approval phase: for orders that require approval, deduct/reserve stock only on transition into APPROVED (or use a two-stage reserve-then-commit model), not on creation. This is a cross-phase rework the team should plan for explicitly rather than discover.

**Warning signs:** If lot/batch phase ships with "stock decrements on order create" and approval phase ships without revisiting that trigger, an order that gets rejected will have already permanently consumed stock with no automatic restore — check specifically for a "restore stock on reject/cancel" path once approval lands.

**Phase to address:** Approval workflow phase must explicitly revisit and rewire the stock-deduction trigger built in the lot/batch phase. Flag this dependency in the roadmap: lot/batch phase should build stock deduction as a callable, reusable step (not hardcoded to "on create") so approval phase can call it at the correct transition point instead of refactoring it.

---

### Pitfall 7: Credit limit / discount threshold checks race with concurrent orders, or are checked with stale data

**What goes wrong:**
Backend enforcement of credit limit and discount thresholds is added as a simple "read customer.availableCredit, compare to order total" check inside the order-create controller. Under concurrent order creation (two sales officers creating orders for the same customer near-simultaneously), both reads see the same "available" credit before either write commits, so both orders pass validation and jointly exceed the limit. Same failure mode applies to lot stock validation (two orders both read "10 available" and both try to sell 8).

**Why it happens:**
Simple read-then-write validation without row locking or a database-level constraint is the natural first implementation, and it looks correct in manual single-user testing (which is likely the only testing this system gets, given zero automated tests per CONCERNS.md).

**How to avoid:**
Wrap credit-check + order-create and stock-check + stock-decrement in a single DB transaction using `SELECT ... FOR UPDATE` (or Prisma's transaction with appropriate isolation level) on the customer/lot row being validated, so concurrent requests serialize correctly. At minimum, re-validate immediately before the write inside the same transaction that performs the write, not in a separate earlier request.

**Warning signs:** Any validation function that runs as a separate DB call before the create/update call, with no shared transaction — this pattern is currently pervasive in this codebase's controllers (per CONCERNS.md, controllers directly call Prisma without a transactional service layer).

**Phase to address:** Backend business rule enforcement phase (credit/discount) and lot/batch stock control phase (stock check) — both should use the same transactional pattern; build one shared "validate-and-lock" helper rather than duplicating the race condition in two features.

---

### Pitfall 8: Decimal/financial precision errors compound once tax/duty/landed-cost calculations are layered on top of existing pricing bugs

**What goes wrong:**
CONCERNS.md already flags that Prisma `Decimal` fields lose precision when JSON-serialized to plain numbers on the frontend. Adding customs duty, excise tax, VAT, freight, insurance, and landed-cost calculations (each potentially multi-step: per-unit → per-case → per-shipment, with rounding at each currency boundary) on top of this existing precision bug multiplies the error surface. Landed cost and excise/stamp calculations are exactly the kind of multi-step chained arithmetic where per-step rounding differences produce numbers that don't reconcile with the physical stamp/tax authority's own calculation — the audit-relevant category of "our system says X, the tax authority's assessment says Y."

**Why it happens:**
JavaScript `number` (IEEE-754 float) is used end-to-end for currency math instead of a fixed-point/Decimal type, and nobody defines a canonical rounding rule (round-half-up vs banker's rounding, and at which step — per unit, per line, or per document total) before implementing tax/duty calculations.

**How to avoid:**
Fix decimal handling as a prerequisite before or during the tax/compliance phase: serialize Decimal fields as strings over the API, use a fixed-point library (e.g., decimal.js) for all financial math on both frontend and backend, and explicitly document a single rounding policy applied consistently (e.g., round to nearest currency unit at the line level, then sum — not sum-then-round or vice versa inconsistently). Write reconciliation tests: given known duty rate + ABV + volume, the calculated excise/stamp quantity and landed cost must match a hand-calculated reference value exactly.

**Warning signs:** Any calculation chain that mixes `Number()` casts with Prisma Decimal without an explicit conversion library; any tax/duty field displayed with more or fewer decimal places than the currency/regulatory format requires.

**Phase to address:** Should be fixed before or at the start of the tax/compliance data phase (it's listed as phase 5 in the suggested order) — but flag it as a dependency of the backend business rule enforcement phase too, since discount/credit checks also do financial math today with the same bug.

---

### Pitfall 9: Compliance/tax fields treated as optional metadata instead of gating "ready for sale" status

**What goes wrong:**
HS code, excise category, ABV, package size, origin country, and import permit/customs/excise document references get added to the schema as nullable columns that can be filled in "eventually," and existing products/import orders created before the migration keep them null indefinitely. Sales orders can still be created against products/lots with missing compliance data, because nothing blocks it — directly contradicting the explicit acceptance criterion "missing compliance fields are visible before goods are marked ready for sale."

**Why it happens:**
Additive schema migrations (required per PROJECT.md constraint: "must not break existing CRUD flows") naturally make new fields nullable to avoid breaking existing records, and it's easy to stop there without also adding the enforcement layer that checks completeness before allowing a lot to move to "available for sale" status.

**How to avoid:**
Separate "schema is additive/nullable" (data-model requirement) from "business rule requires completeness before sale" (enforcement requirement) — these are two different work items. Add an explicit readiness check (e.g., `assertLotReadyForSale(lot)` validating product has HS code/excise category/ABV/package size and the lot has required document references) invoked at the point stock is marked available or at sales-order-creation time, and expose a compliance-completeness report/dashboard flag for existing legacy products so the gap is visible and actionable rather than silently blocking.

**Warning signs:** No dedicated "compliance completeness" validation function exists separate from generic required-field validation; existing seeded/legacy products pass through the new tax/compliance phase with all new fields silently null and no flag surfaced anywhere.

**Phase to address:** Liquor tax and compliance data phase. Should ship with both the schema fields AND the sale-readiness gate in the same phase — don't split them across phases, since a schema-only phase creates a false sense of completeness.

---

### Pitfall 10: Reports/exports use in-memory/frontend aggregation and silently diverge from database state (dashboard KPI trust gap persists)

**What goes wrong:**
PROJECT.md explicitly notes dashboard KPIs are "currently manually maintained" and the goal is to compute them from real data. If the documents/reporting phase (last in the suggested order, after everything else) implements CSV/PDF export and dashboard KPIs by querying with the same unpaginated, N+1-prone, in-memory-filtered patterns already flagged in CONCERNS.md ("no pagination," "unindexed search," in-memory filter), then reports either time out / are slow at realistic data volumes, or worse, an export generated from a partially-loaded/paginated dataset silently under-reports totals without any error.

**Why it happens:**
Reporting is built last, reusing existing `findAll()`-style model methods that already have known scaling issues, under the assumption "it's just a read/export, it'll be fine" — but reports are exactly the workload (full-table scans, cross-entity joins for lot-to-import-to-sale traceability) that stresses those existing weaknesses hardest.

**How to avoid:**
Build reporting/export queries as purpose-built aggregate queries (SQL-level GROUP BY/SUM, not fetch-all-then-reduce-in-JS) from the start, since PROJECT.md explicitly requires "dashboard figures match database records" and full import-to-sale lot traceability. Add database indexes needed for report filters (date, customer, supplier, product, status, warehouse) as part of this phase, not deferred.

**Warning signs:** Any report/export controller that calls a generic `findAll()` and then filters/sums in JavaScript rather than a targeted query; export functionality that has no upper bound on rows processed.

**Phase to address:** Documents & reporting phase (final phase) — but the pagination/indexing groundwork from CONCERNS.md should be scheduled to land no later than this phase, since reporting is the first feature that will expose it in production.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Hardcode role-name checks (`role === 'ADMIN'`) instead of permission-code lookups | Faster to write, no new abstraction needed | Every future role split/permission change requires touching all controllers | Never — the role doc already anticipates future role splitting |
| Single-level approval hardcoded (no approval-chain table) | Matches current explicit scope (multi-level deferred) | Fine as long as data model doesn't need reshaping later; risk only if approver/decision fields aren't modeled generically | Acceptable for this milestone if `approvals` table still models one row per decision (not a single mutable field), so multi-level can be added by adding rows, not restructuring |
| Store `daysRemaining` as a computed-then-cached column (existing pattern, per CONCERNS.md) | Avoids computing on every read | Data goes stale, requires background recompute job; already flagged as fragile | Never for new features — compute on read instead |
| Nullable compliance fields with no completeness gate | Migration doesn't break existing data | Products silently missing tax data can still be sold | Acceptable only if paired with a completeness report immediately, never as end state |
| Audit log written only from generic `update()` model method | Minimal code to add logging | Approve/reject/login/export actions go unaudited | Never — these are explicitly required audit events |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Frontend token storage (new, since no auth existed) | Storing JWT in localStorage with no expiry/refresh handling, causing silent 401s the `useResource` hook already swallows | Use httpOnly cookie or short-lived token + refresh flow, and fix the hook's silent error handling in the same phase so auth failures are visible |
| PDF/CSV export libraries | Generating documents synchronously in the request thread for large datasets, causing timeouts | Stream generation or move to a background job for large exports; keep synchronous only for single-document invoices/delivery notes |
| Existing seed scripts | Seed data no longer matches new required fields (roles, permissions, compliance fields) after each phase, breaking dev setup silently | Update seed script in the same PR as each schema migration; treat seed breakage as a CI gate once tests exist |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Row-level lock contention on customer/lot rows for credit & stock validation | Order creation slows or deadlocks under concurrent sales officers | Keep transactions short (validate+write only), correct index on lot/customer PK, avoid locking unrelated rows | Noticeable once >2-3 concurrent order-creators hit the same customer/lot regularly |
| Audit log table growth with no retention/archival policy | Audit log queries slow down over time; table becomes largest in DB | Index on (entity, entityId, timestamp) and (userId, timestamp); define retention/archival policy per compliance requirement mentioned in improvement-advice.md | Noticeable after months of full audit coverage across all sensitive actions |
| Report queries doing full traceability joins (import → lot → sale) without indexes | Compliance/traceability reports slow to unusable | Add indexes on lot/batch FK columns used in traceability joins before reporting phase | At moderate transaction volume (thousands of lots/orders), well before "1M users" scale — this is a low-volume-per-tenant internal system so it breaks on join complexity, not row count |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating frontend role/permission checks as sufficient because "the UI already hides it" | Direct API calls bypass all UI-only restrictions (explicitly the core value statement of this milestone) | Every state-changing endpoint must independently re-check permission + business rules server-side; treat this as the primary acceptance criterion for every phase |
| JWT with no expiry or no revocation path | A compromised/leaked token remains valid indefinitely; a deactivated user (per role doc's "deactivate users" capability) can still act until token naturally expires | Short-lived access tokens + refresh tokens, and check user `status` (active/deactivated) on each request, not only at login |
| Audit log accessible/editable via generic admin CRUD UI once one exists | Defeats the entire purpose of audit logging for compliance | Never register write/delete routes for the audit table; enforce this at the router level, not just permission level |
| CORS still unrestricted (existing issue per CONCERNS.md) when auth is added | Credentialed requests (cookies/tokens) become exploitable via CSRF from any origin once auth exists | Fix CORS allow-list in the same phase auth is introduced — auth without CORS restriction is a materially worse security posture than no auth at all, since now there's a session to steal |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Permission-denied errors shown as generic failures | Users don't know if they lack permission, hit a business rule (credit/stock/license), or hit a bug | Return distinct, human-readable error codes/messages for permission-denied vs. business-rule-violation vs. system-error, and surface them via toast (fixing the existing silent-error hook gap) |
| Approval rejection with no reason shown to the submitter | Sales/import officers resubmit blindly or escalate manually | Enforce rejection reason as required input and surface it prominently on the order detail view |
| Lot/batch selection UI doesn't show remaining quantity live | Users pick a lot that's already been consumed by another concurrent order, hitting an error only at submit | Show live/near-live remaining quantity per lot at selection time, and handle the submit-time race gracefully with a clear "quantity changed, please reselect" message rather than a generic error |

## "Looks Done But Isn't" Checklist

- [ ] **Login/auth:** Often missing session/token expiry and deactivated-user re-checks — verify a deactivated user is locked out immediately, not just prevented from future logins
- [ ] **RBAC:** Often missing enforcement on read endpoints (only write endpoints get gated) — verify sensitive view-only data (financial reports, other users' sales) is also permission-checked
- [ ] **Audit logging:** Often missing coverage for approve/reject/login/export actions since they're not standard CRUD — verify each of the six explicitly required action types (create/update/delete/approve/reject/login/export) has a real audit row, not just create/update/delete
- [ ] **Lot/batch stock control:** Often missing the edit/delete-restores-previous-quantity path — verify by testing edit and delete/cancel of a sales order, not just creation
- [ ] **Approval workflow:** Often missing the "stock isn't affected until approved" rule when it's bolted onto lot/batch logic built in an earlier phase — verify a PENDING_APPROVAL order does not decrement lot stock until it transitions to APPROVED
- [ ] **No self-approval:** Often missing the check for users with multiple roles — verify a user holding both Sales Officer and Manager/Approver roles cannot approve their own order
- [ ] **Liquor tax/compliance data:** Often present as schema fields only — verify a "ready for sale" gate actually blocks incomplete products/lots, and that existing legacy products are flagged, not silently passed
- [ ] **Financial/tax calculations:** Often correct in the happy path but wrong at rounding boundaries — verify with a known reference calculation (hand-computed duty/excise/landed cost) not just "the number looks plausible"
- [ ] **Documents/reporting:** Often built against `findAll()`-style unpaginated queries — verify report/export performance and correctness against a dataset large enough to require pagination in the underlying list views

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|----------------|-----------------|
| Big-bang auth cutover broke flows | MEDIUM | Roll back enforcement middleware to audit-only mode, fix frontend client token wiring, re-enable enforcement route group by route group |
| Stock desync between lot/StockTransaction/product aggregate | HIGH | Freeze writes, run a reconciliation script recomputing aggregates from StockTransaction history as ground truth, manually resolve discrepancies with warehouse team, then centralize the movement function before resuming writes |
| Illegal status transition already occurred in production data | MEDIUM | Add the transition-guard code first (stop the bleeding), then write a one-off data-repair script to move any orders stuck in invalid/unreachable states to a valid state with an audit-logged manual correction entry |
| Self-approval already happened before the check was added | LOW-MEDIUM | Audit log (if present) identifies affected records; flag them for manual re-review by a different approver; add regression test before closing |
| Compliance fields missing on legacy products already sold | MEDIUM | Generate a compliance-gap report for all historical products/lots, prioritize backfill by sale recency/volume, do not retroactively block already-completed sales but block future sales until backfilled |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| Big-bang auth cutover breaks existing flows | Auth/RBAC/audit phase | Staged rollout checklist completed; frontend shows real error messages, not silent failures, when a call is rejected |
| Hardcoded role checks / role explosion | Auth/RBAC/audit phase | Code review finds zero direct role-string comparisons outside the auth module |
| Self-approval bypass via API | Auth/RBAC/audit phase (initial check) + Approval workflow phase (full status machine) | Automated test: multi-role user cannot approve own order |
| Mutable/incomplete audit log | Auth/RBAC/audit phase | No PUT/DELETE route exists for audit log; every approve/reject/login/export action produces a log row in test |
| Lot/product stock desync | Lot/batch stock control phase | Reconciliation test: sum of StockTransactions per lot equals InventoryStock.quantityOnHand equals product aggregate, after create/edit/delete cycles |
| Illegal or improperly-timed status transitions | Approval workflow phase | Transition-map unit tests; stock-deduction trigger point verified to fire on APPROVED, not on create, for orders requiring approval |
| Credit/stock race conditions | Backend rule enforcement phase + Lot/batch phase | Concurrency test (parallel requests) confirms limit/stock cannot be exceeded |
| Decimal/financial precision errors | Backend rule enforcement phase (baseline fix) + Tax/compliance phase (duty/excise chains) | Reference-value test: known inputs produce exact expected duty/excise/landed-cost output |
| Compliance fields present but not enforced | Tax/compliance data phase | "Ready for sale" gate blocks incomplete products/lots in test; legacy-data gap report exists |
| Reports/exports use unscaled queries | Documents & reporting phase | Report/export queries use DB-level aggregation with required indexes; tested against realistic data volume |

## Sources

- Direct inspection: `.planning/PROJECT.md`, `.planning/codebase/CONCERNS.md`, `liquor-system-improvement-advice.md`, `liquor-system-basic-role-permission-recommendation.md` (this repository) — HIGH confidence, primary source for all codebase-specific pitfalls
- [10 RBAC Best Practices You Should Know in 2025 — Oso](https://www.osohq.com/learn/rbac-best-practices) — MEDIUM confidence, general RBAC role-design/role-explosion pitfalls
- [Common Challenges in Role-Based Access Control Implementation — Censinet](https://censinet.com/perspectives/common-challenges-role-based-access-control-implementation) — MEDIUM confidence, legacy-system RBAC integration challenges
- [Role-Based Access Control Best Practices for 2026 — TechPrescient](https://www.techprescient.com/blogs/role-based-access-control-best-practices/) — MEDIUM confidence, phased-rollout recommendation
- [What is excise tax software? — Hyperbots](https://www.hyperbots.com/glossary/excise-tax-software) — MEDIUM confidence, excise tax calculation/reporting pipeline structure
- [Brewery TTB Compliance: A Complete Guide — CrafterERP](https://craftederp.com/the-buzz/brewery-ttb-compliance) — MEDIUM confidence, inventory-reconciliation-across-siloed-systems pitfall in alcohol compliance, corroborates this project's own "lot must trace to compliance docs" requirement
- General software engineering knowledge (training data, LOW-MEDIUM confidence where not corroborated above): status-machine/transition-guard patterns, transactional row-locking for race conditions, decimal/fixed-point arithmetic best practices for financial calculations

---
*Pitfalls research for: Retrofitting auth/RBAC/audit/lot-tracking/approval/tax-compliance onto an existing liquor import-sales system*
*Researched: 2026-09-03*
