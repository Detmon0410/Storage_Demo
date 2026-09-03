# Technology Stack

**Project:** Storage Demo — Production Readiness (Auth/RBAC, Audit Log, Approval, Lot Control, Documents)
**Researched:** 2026-09-03
**Scope note:** This is an additive-dependency research pass for an existing Node/Express 4.21/Prisma 6.4/MySQL + React 19/Vite backend. No framework swap. Versions below verified live against npm registry on research date (HIGH confidence) and cross-checked against 2025/2026 security guidance (MEDIUM-HIGH confidence).

## Recommended Stack

### Authentication (custom, no third-party IdP)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `argon2` (node-argon2, native binding) | 0.45.1 | Password hashing | OWASP's current primary recommendation (Argon2id) for new systems — memory-hard, resists GPU/ASIC cracking better than bcrypt. This is a new auth subsystem being built from scratch, so there's no legacy-hash migration cost to justify picking bcrypt instead. Use the native binding, not a pure-JS argon2 implementation (100x slower, forces weaker params). |
| `jsonwebtoken` | 9.0.3 | Access token signing/verification | Mature, ubiquitous, zero-dependency-risk choice for custom JWT issuance. Matches "custom auth, no third-party provider" constraint in PROJECT.md. |
| `cookie-parser` | 1.4.7 | Parse httpOnly cookies for refresh-token flow | Required companion to Express when storing tokens in cookies rather than `Authorization` headers. |
| Native `crypto.randomUUID()` / `crypto.randomBytes` (Node built-in) | Node 20+ built-in | Refresh token generation, session IDs | No extra dependency needed — Node 20's built-in `crypto` module covers this. |

**Session/token architecture recommendation:** short-lived JWT (10–15 min) as access token, stored in memory on the frontend (not localStorage); a random opaque refresh token stored in an `httpOnly`, `Secure`, `SameSite=Strict` cookie, persisted server-side in a `sessions`/`refresh_tokens` Prisma table (allows revocation — plain JWTs can't be revoked without a blocklist). This directly satisfies the audit requirement ("record login") and the "audit logs cannot be edited through normal screens" requirement, since sessions become a first-class DB entity you can log against.

**What NOT to use and why:**
- **Do not use `express-session` + in-memory/MemoryStore.** It's not production-safe (leaks memory, doesn't scale past one process) and pushes you toward server-side session state that duplicates what a refresh-token table already gives you more cleanly with Prisma. If you want express-session anyway for its ecosystem (connect maturity), pair it with `express-mysql-session`(not evaluated here) — but for a from-scratch build, JWT+refresh-table is simpler to reason about and audit.
- **Do not use `bcrypt`/`bcryptjs` for new password storage.** It's an acceptable fallback (still fine at cost≥10) but Argon2id is the current OWASP/NIST-aligned default and there's no existing bcrypt data to migrate here — no reason to pick the second-best option for a greenfield auth table.
- **Do not reach for Passport.js.** Passport is designed to unify many auth strategies (OAuth, SAML, third-party). This project explicitly wants pure username/password custom auth; Passport adds abstraction/indirection with no corresponding benefit here.
- **Do not store JWTs in localStorage.** XSS-accessible; any injected script can exfiltrate every session. httpOnly cookies are immune to JS access.

### RBAC (custom middleware, no external RBAC library)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom Express middleware (`requireAuth`, `requirePermission(code)`) | n/a — hand-rolled | Enforce authentication + fine-grained permission checks per route | The permission doc (`liquor-system-basic-role-permission-recommendation.md`) defines a `users/roles/user_roles/permissions/role_permissions` many-to-many schema — this maps directly onto a Prisma-queried permission set, cached per-request on `req.user.permissions`. No mainstream npm RBAC library (e.g. `casl`, `accesscontrol`) is necessary at this scale (6 roles, flat permission codes, no resource-instance-level ABAC needs beyond "no self-approval," which is a one-line check, not a policy engine problem). |
| `@casl/ability` (optional, only if conditional/ownership rules grow) | 6.x (verify at implementation time) | Declarative ability rules if permission logic becomes conditional (e.g., "own records only") | Flagged as an **optional escape hatch**, not a default pick. Only reach for it if the flat `role_permissions` table proves insufficient for record-level rules beyond "no self-approval" (which is trivially `createdBy !== req.user.id`, no library needed). |

**Middleware pattern (Express 4.21, matches existing `asyncHandler`/controller conventions):**
```typescript
// apps/backend/src/middleware/auth.ts
export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies.accessToken ?? extractBearer(req);
  if (!token) throw new HttpError(401, "Not authenticated");
  req.user = verifyAccessToken(token); // throws HttpError(401) on invalid/expired
  next();
});

// apps/backend/src/middleware/permissions.ts
export const requirePermission = (code: string) =>
  asyncHandler(async (req, res, next) => {
    const perms = await getUserPermissions(req.user.id); // cached, from user_roles -> role_permissions
    if (!perms.has(code)) throw new HttpError(403, "Forbidden");
    next();
  });
```
This slots into the existing route → controller pattern with zero new architectural layers: `router.post("/sales-orders/:id/approve", requireAuth, requirePermission("SALES_ORDER_APPROVE"), controller)`.

**What NOT to use and why:**
- **Do not use `accesscontrol` (npm) or similar generic RBAC packages** for this scale. They add API surface and a config DSL for a problem that's a straightforward join query against 5 Prisma tables. Introduce complexity only when the flat model breaks down.
- **Do not hardcode role checks in controllers** (`if (req.user.role === 'ADMIN')`). The PROJECT.md explicitly requires multi-role support per user — a permission-code lookup (not role-name string comparison) is the only approach that supports "combined permissions from all assigned roles" cleanly.

### Audit Logging (Prisma-based, no external audit library)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Custom `AuditLog` Prisma model + service function | Prisma 6.4.1 (existing) | Record create/update/delete/approve/reject/login/export actions with before/after values | No mainstream npm package cleanly covers "generic Prisma audit trail with before/after diff + user/IP context" for MySQL without vendor lock-in or heavy assumptions about your schema. Hand-rolling is standard practice here. |
| Prisma Client Extensions (`$extends` / `$allOperations`) | Built into Prisma 6.4.1 — no separate install | Intercept create/update/delete at the Prisma Client level to auto-capture before/after state | Prisma 6.x's Client Extensions API is the current (post-deprecation) mechanism for this — **`prisma.$use()` middleware was deprecated in Prisma 5 and is scheduled for removal**; only `$extends` is future-proof. Verify at implementation time that the installed 6.4.1 client still supports `$use` as a fallback, but write new code against `$extends`. |

**Recommended `AuditLog` schema shape (additive to existing Prisma schema):**
```prisma
model AuditLog {
  id         BigInt   @id @default(autoincrement())
  userId     Int?     // nullable for failed-login-before-auth events
  action     String   // CREATE | UPDATE | DELETE | APPROVE | REJECT | LOGIN | LOGIN_FAILED | EXPORT
  entityType String   // e.g. "SalesOrder"
  entityId   String?  // stringified PK, nullable for non-entity actions like LOGIN
  before     Json?
  after      Json?
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())

  @@index([entityType, entityId])
  @@index([userId, createdAt])
}
```
Two viable capture strategies — recommend **explicit service-layer logging calls** (call `AuditService.log(...)` inside each Model method that mutates state, right next to the `prisma.$transaction()` calls that already exist) over automatic Prisma-extension interception, because:
1. The existing codebase's `ResourceModel` pattern already centralizes all writes in `apps/backend/src/models/` — audit calls fit naturally alongside the existing transaction blocks with full business context (which fields actually matter for a diff, what the "action" semantically is — e.g. distinguishing APPROVE from a generic UPDATE on the same row).
2. Automatic global interception (Client Extensions) can't easily distinguish "approve" from "edit" — both are SQL `UPDATE`s — without extra metadata threaded through anyway, defeating the automation benefit.
3. Login/export actions aren't Prisma writes to the audited entity at all, so a Prisma-extension approach only covers part of the requirement regardless.

Use Prisma Client Extensions only as a **safety net** for catching writes that bypass explicit logging (defense in depth), not as the primary mechanism.

**What NOT to use and why:**
- **Do not use generic "audit-log" npm packages** (e.g., `mongoose-audit-log`-style packages targeting Mongoose, or unmaintained Prisma audit middlewares with <1k weekly downloads). None are MySQL/Prisma-6-native and well-maintained enough to trust for a compliance-sensitive audit trail; a 150-line hand-rolled service is more auditable itself and has zero supply-chain risk for a security-critical subsystem.
- **Do not rely solely on MySQL triggers for audit trails.** They can't capture `userId`/IP/session context (that's application-layer, not DB-layer, information) and would create a second source of truth outside Prisma migrations.

### Documents & Reporting (PDF/CSV export)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `pdfkit` | 0.20.2 | Generate sales invoice, tax invoice, delivery note, picking list, import summary, receiving report as PDF | Low memory footprint (5–10MB) and fast (<100ms) programmatic PDF generation — ideal for structured business documents built from known data fields (line items, totals, headers) rather than arbitrary HTML layouts. No headless-browser overhead, which matters since this backend has no existing browser-automation dependency and Puppeteer would be a heavy new addition (Chromium binary bundling ~300MB+). |
| `csv-stringify` | 6.8.3 | CSV export for filtered reports (date/customer/supplier/product/status/warehouse) | Part of the mature `csv` package family; stream-based, RFC 4180 compliant, handles large report datasets without buffering the whole result set in memory — appropriate for reports that could grow with transaction volume over time. |
| `exceljs` | 4.4.0 | **Optional** — Excel (.xlsx) export if finance/accounting stakeholders need pivotable spreadsheets rather than flat CSV | Not explicitly required by PROJECT.md (only CSV/PDF requested), but flagged because Finance/Accounting Officer role's report-heavy workflow commonly outgrows CSV in practice. Treat as a fast-follow, not MVP-required. |

**What NOT to use and why:**
- **Do not use Puppeteer/Playwright for these documents.** They excel at rendering arbitrary HTML+CSS (e.g., pixel-perfect marketing PDFs, existing web pages), but that strength is irrelevant here — invoices/picking lists are structured tabular documents with fixed layouts, exactly PDFKit's sweet spot. Puppeteer also bundles a full Chromium binary, is 10-30x slower per document (1-3s vs <100ms), and uses 10-20x the memory — a poor fit for a report-generation endpoint that may be called frequently and needs to stay lightweight on a small internal-tool server.
- **Do not use `pdfmake`** as a first choice — it's a fine declarative alternative to PDFKit (JSON document-definition style) but offers no clear advantage for this project's needs over PDFKit's more directly-controlled drawing API, and would be a second PDF library concept to learn with no added capability.
- **Do not use `json2csv`** — it is effectively unmaintained/superseded by the `csv-stringify` family; the search results confirm `csv-stringify`/`fast-csv` as the current maintained choices for Node backend CSV generation.
- **Do not build documents by string-concatenating HTML and hoping the browser prints it "well enough."** Doesn't satisfy "download standard documents from order detail pages" as a backend-generated file requirement, and produces inconsistent output across browsers/print settings.

### Supporting / Cross-Cutting (recommended but not explicitly requested — flag for roadmap discussion)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `helmet` | 8.3.0 | Sets secure HTTP headers (CSP, HSTS, X-Frame-Options, etc.) | Should be added alongside auth work — a production-facing app with login should not ship without baseline header hardening. Near-zero integration cost (`app.use(helmet())`). |
| `express-rate-limit` | 8.7.0 | Rate-limit login/auth endpoints to blunt credential-stuffing/brute-force | PROJECT.md's CONCERNS.md already flags "no rate limiting" as a known gap; the login endpoint is the highest-value place to close it first. |
| `zod` | 4.5.4 | Request body/schema validation (login payloads, permission codes, approval-decision payloads) | ARCHITECTURE.md notes current validation is ad hoc/controller-level with "no client-side schema validation library" and implicitly none server-side either. Auth/RBAC introduces new untrusted-input surface (login credentials, role assignment payloads) where a validation library materially reduces injection/type-confusion risk versus hand-rolled `if` checks. Optional but recommended; can be scoped to just the new auth/audit routes if a full rollout is out of scope for this milestone. |
| `pino` + `pino-http` | 10.3.1 / 11.0.0 | Structured JSON logging (replacing bare `console.error`) | ARCHITECTURE.md confirms current logging is `console.error()` only. Audit logging (business event trail in DB) and application logging (operational/error trail, typically to stdout/file) are different concerns — pino is the standard low-overhead structured logger for Node/Express in 2025/2026 and would let audit-log write failures, auth failures, etc. be traced operationally without polluting the AuditLog table with system noise. |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Password hashing | argon2 (native) | bcrypt | bcrypt is an acceptable fallback but Argon2id is the current OWASP-recommended default for new systems with no legacy data to migrate |
| Password hashing | argon2 (native) | scrypt (Node built-in `crypto.scrypt`) | No external dependency needed, but weaker ecosystem tooling/defaults around parameter tuning than the `argon2` package; Argon2id is the more explicitly recommended winner of the Password Hashing Competition |
| Token strategy | JWT (access) + opaque refresh token in DB | express-session (server-side sessions only) | Doesn't naturally fit a monorepo with a separate Vite-built SPA frontend making cross-origin-ish requests during dev; JWT decouples auth state from a single Express process's session store |
| RBAC | Hand-rolled permission middleware | casl / accesscontrol npm packages | Overkill for 6 flat roles + permission codes with one ownership rule (no self-approval); adds a DSL to learn for no functional gain at this scale |
| Audit logging | Explicit service-layer logging calls | Prisma Client Extensions (fully automatic) | Automatic interception can't distinguish semantically distinct actions (APPROVE vs generic UPDATE) that share the same SQL verb, and doesn't cover non-Prisma events (LOGIN, EXPORT) at all |
| PDF generation | pdfkit | puppeteer | 10-30x slower, 10-20x more memory, adds a ~300MB Chromium dependency for a use case (structured business documents) that doesn't need HTML rendering |
| CSV generation | csv-stringify | json2csv | json2csv is effectively legacy/superseded; csv-stringify is the actively maintained, stream-capable choice |

## Installation

```bash
# Backend — auth, RBAC, audit
cd apps/backend
pnpm add argon2 jsonwebtoken cookie-parser
pnpm add -D @types/jsonwebtoken @types/cookie-parser

# Backend — hardening (recommended alongside auth work)
pnpm add helmet express-rate-limit zod

# Backend — documents/reporting
pnpm add pdfkit csv-stringify
pnpm add -D @types/pdfkit

# Backend — structured logging (optional but recommended)
pnpm add pino pino-http

# Optional fast-follow (only if Excel export is prioritized)
pnpm add exceljs
```

No frontend dependency additions are required for this milestone's stack decisions — auth state on the frontend (storing the short-lived access token in memory, e.g. a React context) does not require a new library given React 19 + existing hooks pattern already in `apps/frontend/src/hooks/`.

## Sources

- OWASP Password Storage Cheat Sheet guidance reflected in: [Argon2 vs Bcrypt vs Scrypt vs PBKDF2 (2026 Guide)](https://guptadeepak.com/the-complete-guide-to-password-hashing-argon2-vs-bcrypt-vs-scrypt-vs-pbkdf2-2026/) — MEDIUM confidence (secondary source aggregating OWASP/NIST positions; cross-check OWASP Cheat Sheet directly before final implementation)
- [Node.js Auth Security Best Practices (2026)](https://www.authgear.com/post/nodejs-security-best-practices/) — MEDIUM confidence
- [Building authentication in Node.js applications: The complete guide (2026)](https://workos.com/blog/nodejs-authentication-guide-2026) — MEDIUM confidence
- [Top JavaScript PDF generator libraries for 2026 - Nutrient](https://www.nutrient.io/blog/top-js-pdf-libraries/) — MEDIUM confidence
- [Node.js PDF Generation: PDFKit vs Puppeteer vs jsPDF Comparison](https://reintech.io/blog/nodejs-pdf-generation-pdfkit-puppeteer-jspdf-comparison) — MEDIUM confidence (performance numbers cited)
- [csv-stringify vs fast-csv vs json2csv vs papaparse](https://npm-compare.com/csv-stringify,fast-csv,json2csv,papaparse) — MEDIUM confidence
- Live `npm view <pkg> version` registry queries (argon2, bcrypt, jsonwebtoken, express-session, cookie-parser, express-rate-limit, helmet, zod, pdfkit, puppeteer, exceljs, csv-stringify, fast-csv, pino, pino-http) — **HIGH confidence**, verified 2026-09-03 directly against npm registry
- Prisma Client Extensions vs `$use` middleware deprecation — based on training-data knowledge of Prisma's documented middleware deprecation path (Prisma 4.16+ introduced `$extends`, Prisma 5 deprecated `$use`); **MEDIUM confidence, not independently re-verified against live Prisma 6.4 docs in this pass — verify current `$use` removal status against official Prisma docs before implementation** (flagged gap)
- Existing codebase context: `.planning/codebase/STACK.md`, `.planning/codebase/ARCHITECTURE.md`, `.planning/PROJECT.md`, `liquor-system-improvement-advice.md`, `liquor-system-basic-role-permission-recommendation.md`
