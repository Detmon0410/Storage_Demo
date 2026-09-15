# Phase 3: Backend Enforcement & Lot/Batch Stock Control - Pattern Map

**Mapped:** 2026-09-15
**Files analyzed:** 17 (schema + 9 backend files to modify + 5 new backend files + 1 frontend file + seed)
**Analogs found:** 15 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `apps/backend/prisma/schema.prisma` (SalesOrderItem.inventoryStockId FK, StockTransaction.inventoryStockId FK, SalesOrder.requiresApproval + updatedById, StockAdjustment/reason enum) | migration/config | CRUD | Same file, existing `SalesOrderItem`/`StockTransaction`/`CustomerLicense` model blocks | exact (in-file precedent) |
| `apps/backend/src/utils/lotGate.ts` (NEW: `assertLotQuantityTx`, FIFO-suggestion helper) | utility (guard) | request-response | `apps/backend/src/utils/licenseGate.ts` | exact |
| `apps/backend/src/utils/creditDiscountGate.ts` (NEW: `assertCreditAndDiscountTx`) | utility (guard) | request-response | `apps/backend/src/utils/licenseGate.ts` | exact |
| `apps/backend/src/models/stockTransaction.model.ts` (extend `createStockTransactionTx`/`reverseAndDeleteByReferenceTx` to touch `InventoryStock.quantityOnHand`, add `inventoryStockId` to `StockTransactionInput`) | service/model | CRUD | itself (extend in place) | exact |
| `apps/backend/src/models/salesOrder.model.ts` (wire in lotGate + creditDiscountGate, `inventoryStockId` replaces `lotBatch` on items, `requiresApproval` flag, `updatedById` tracking) | service/model | CRUD | itself (extend in place); `importOrder.model.ts` as sibling pattern | exact |
| `apps/backend/src/models/importOrder.model.ts` (gate `createStockInTx` behind `status === "RECEIVED"`, reject item edits once `RECEIVED`) | service/model | CRUD | itself (extend in place); `salesOrder.model.ts` reverse-then-reapply sibling | exact |
| `apps/backend/src/models/inventoryStock.model.ts` (NEW: `adjustStockTx`, remove `quantityOnHand` from generic `update`) | service/model | CRUD | itself (extend); `stockTransaction.model.ts`'s `createStockTransactionTx`/`delete` for the audited-mutation shape | exact |
| `apps/backend/src/controllers/salesOrder.controller.ts` (`parseItems` accepts `inventoryStockId` not `lotBatch`; ENFORCE-05 numeric validation; approve endpoint checks `updatedById` too) | controller | request-response | itself (extend); `importOrder.controller.ts` sibling | exact |
| `apps/backend/src/controllers/importOrder.controller.ts` (approve/reject `updatedById` check; reject edits when `RECEIVED`) | controller | request-response | itself (extend); `salesOrder.controller.ts` sibling | exact |
| `apps/backend/src/controllers/inventoryStock.controller.ts` (remove `quantityOnHand` from `updateInventoryStock`; NEW `adjustInventoryStock` controller) | controller | request-response | itself (extend); pattern for the new adjust action mirrors `approveSalesOrder`'s "narrow action controller with own audit record" shape | exact |
| `apps/backend/src/routes/inventoryStock.routes.ts` (NEW `POST /:id/adjust` route, gated by a Warehouse-officer permission) | route | request-response | `apps/backend/src/routes/salesOrder.routes.ts` (`POST /:id/approve` pattern) | exact |
| `apps/backend/prisma/seed.ts` (re-seed so only `RECEIVED` import orders produce `InventoryStock`/`StockTransaction` rows; seed `SalesOrderItem.inventoryStockId` instead of free-text `lotBatch`) | config/seed | batch | itself (existing seed structure) | role-match |
| `apps/backend/tests/stock.lotQuantity.test.ts` (NEW) | test | request-response | `apps/backend/tests/salesOrder.license-block.test.ts` | exact |
| `apps/backend/tests/salesOrder.creditLimit.test.ts`, `salesOrder.discountLimit.test.ts` (NEW) | test | request-response | `apps/backend/tests/salesOrder.license-block.test.ts` | exact |
| `apps/backend/tests/stock.lotDecrement.test.ts`, `stock.lotReverseReapply.test.ts` (NEW) | test | CRUD | `apps/backend/tests/salesOrder.license-block.test.ts` (fixture setup) + `stockTransaction.model.ts` behavior under test | role-match |
| `apps/backend/tests/importOrder.receivingLots.test.ts` (NEW) | test | CRUD | `apps/backend/tests/order.noSelfApproval.test.ts` (has both import + sales fixtures) | role-match |
| `apps/backend/tests/inventoryStock.adjustment.test.ts` (NEW) | test | request-response | `apps/backend/tests/order.noSelfApproval.test.ts` (permission + audit assertions) | role-match |
| `apps/backend/tests/order.noSelfApproval.test.ts` (extend for `updatedById` "last edited" clause) | test | request-response | itself (extend in place) | exact |
| `apps/backend/tests/*` referencing `lotBatch: "..."` on `SalesOrderItem` (migration sweep — `rbac.enforcement.writes.orders.test.ts`, `audit.crud.orders.test.ts`, etc.) | test | CRUD | `salesOrder.license-block.test.ts` fixture style | exact |
| `apps/frontend/src/pages/SalesOrdersPage.tsx` (submit `inventoryStockId` not `lotBatch`; keep lot `<select>` UI, change payload wiring) | component | request-response | itself (existing lot-select `<select>` at lines ~505-525) | exact |
| `apps/backend/src/utils/rounding.ts` (NEW — no existing rounding helper found; see below) | utility | transform | none found in codebase | no analog |

## Pattern Assignments

### `apps/backend/src/utils/lotGate.ts` (utility/guard, request-response)

**Analog:** `apps/backend/src/utils/licenseGate.ts` (full file, 17 lines — read in full)

**Full pattern to copy (imports + guard shape + error wording):**
```typescript
// Source: apps/backend/src/utils/licenseGate.ts (verified in repo)
import type { Prisma } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import { computePermitStatus } from "./permitStatus.js";

export const assertProductsNotBlockedTx = async (tx: Prisma.TransactionClient, productIds: number[]) => {
  const uniqueIds = [...new Set(productIds)].filter((id) => Number.isFinite(id));
  if (uniqueIds.length === 0) return;

  const licenses = await tx.license.findMany({ where: { productId: { in: uniqueIds } } });
  for (const license of licenses) {
    const { status } = computePermitStatus(license.expiryDate);
    if (status === "EXPIRED") {
      throw new HttpError(400, `Product ${license.productId} has an expired permit (license ${license.licenseNo}) and cannot be ordered until it is resolved`);
    }
  }
};
```

**Build `assertLotQuantityTx` in this exact shape:**
```typescript
export const assertLotQuantityTx = async (
  tx: Prisma.TransactionClient,
  items: { inventoryStockId: number; quantity: number }[],
) => {
  const ids = [...new Set(items.map((i) => i.inventoryStockId))].filter((id) => Number.isFinite(id));
  if (ids.length === 0) return;
  const lots = await tx.inventoryStock.findMany({ where: { inventoryStockId: { in: ids } } });
  const byId = new Map(lots.map((l) => [l.inventoryStockId, l]));
  for (const item of items) {
    const lot = byId.get(item.inventoryStockId);
    if (!lot) throw new HttpError(404, `Inventory lot ${item.inventoryStockId} not found`);
    if (lot.quantityOnHand < item.quantity) {
      // "Insufficient" wording matches stockTransaction.model.ts's existing message style —
      // tests grep for lowercase "insufficient" per RESEARCH.md Validation Architecture section
      throw new HttpError(
        400,
        `Insufficient stock for lot ${lot.lotBatch}: requested ${item.quantity}, available ${lot.quantityOnHand}`,
      );
    }
  }
};
```

**FIFO-suggestion helper (D-02, backend auto-suggest oldest lot):**
```typescript
export const suggestFifoLot = (tx: Prisma.TransactionClient, productId: number) =>
  tx.inventoryStock.findFirst({
    where: { productId, quantityOnHand: { gt: 0 } },
    orderBy: { receivedDate: "asc" },
  });
```

---

### `apps/backend/src/utils/creditDiscountGate.ts` (utility/guard, request-response)

**Analog:** `apps/backend/src/utils/licenseGate.ts` (same shape as above — `(tx, ...) => throws HttpError`)

**Core pattern (D-05, ENFORCE-03/04):**
```typescript
export const assertCreditAndDiscountTx = async (
  tx: Prisma.TransactionClient,
  customerId: number,
  orderNetValue: number, // already rounded per-line, see rounding note below
  items: { discount: number }[],
) => {
  const customer = await tx.customer.findUnique({ where: { customerId } });
  if (!customer) throw new HttpError(404, "Customer not found");

  const projectedBalance = Number(customer.currentBalance) + orderNetValue;
  const overCredit = projectedBalance > Number(customer.creditLimit);
  const overDiscount = items.some((i) => i.discount > Number(customer.standardDiscount));

  return { requiresApproval: overCredit || overDiscount };
  // D-05: soft-block only — caller sets SalesOrder.requiresApproval, does NOT throw here.
  // Contrast with assertLotQuantityTx/assertProductsNotBlockedTx, which hard-reject.
};
```
Mirrors the frontend's now-cosmetic logic at `apps/frontend/src/pages/SalesOrdersPage.tsx` lines
142-154 (`projectedBalance`, `needsApproval`) — re-derive server-side from DB values, never trust
client input, per RESEARCH.md's Anti-Patterns section.

---

### `apps/backend/src/models/stockTransaction.model.ts` (service/model, CRUD)

**Analog:** itself — extend in place (already read in full, 84 lines)

**Current create/decrement pattern (lines 20-41) to extend one level down:**
```typescript
export async function createStockTransactionTx(tx: Prisma.TransactionClient, data: StockTransactionInput) {
  if (data.transactionType === "OUT") {
    const product = await tx.product.findUnique({
      where: { productId: data.productId },
      select: { stockQty: true, productName: true },
    });
    if (!product) throw new HttpError(404, `Product ${data.productId} not found`);
    if (product.stockQty < data.quantity) {
      throw new HttpError(400, `Insufficient stock for ${product.productName}: requested ${data.quantity}, available ${product.stockQty}`);
    }
  }
  const transaction = await tx.stockTransaction.create({ data });
  await tx.product.update({
    where: { productId: data.productId },
    data: { stockQty: { increment: stockDelta(data.transactionType, data.quantity) } },
  });
  return transaction;
}
```
**Extension:** add `inventoryStockId?: number` to `StockTransactionInput` (D-08/Pitfall 1); when
present, also `tx.inventoryStock.update({ where: { inventoryStockId }, data: { quantityOnHand: { increment: stockDelta(...) } } })` in the same function, following the exact `increment`/`stockDelta` idiom already used for `Product.stockQty` — same transaction, same delta helper, no new logic invented.

**Current reverse-then-delete pattern (lines 43-52) to extend one level down (D-03/STOCK-03):**
```typescript
export async function reverseAndDeleteByReferenceTx(tx: Prisma.TransactionClient, referenceNo: string) {
  const existing = await tx.stockTransaction.findMany({ where: { referenceNo } });
  for (const transaction of existing) {
    await tx.product.update({
      where: { productId: transaction.productId },
      data: { stockQty: { increment: -stockDelta(transaction.transactionType, transaction.quantity) } },
    });
  }
  await tx.stockTransaction.deleteMany({ where: { referenceNo } });
}
```
Add the `if (transaction.inventoryStockId != null) { await tx.inventoryStock.update(...) }` branch
per RESEARCH.md's Pattern 2 code sketch (already fully written out there) — copy that sketch verbatim,
it was authored against this exact function signature.

---

### `apps/backend/src/models/salesOrder.model.ts` (service/model, CRUD)

**Analog:** itself — extend in place (already read in full, 197 lines)

**Imports pattern (lines 1-7) — new guard imports slot in the same block:**
```typescript
import type { PrismaClient, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import { assertProductsNotBlockedTx } from "../utils/licenseGate.js";
import { isLicenseValid } from "./customerLicense.model.js";
import { createStockTransactionTx, reverseAndDeleteByReferenceTx } from "./stockTransaction.model.js";
import { salesOrderStockReference } from "../utils/stockReference.js";
// NEW: import { assertLotQuantityTx } from "../utils/lotGate.js";
// NEW: import { assertCreditAndDiscountTx } from "../utils/creditDiscountGate.js";
```

**`SalesOrderItemInput.lotBatch: string` (line 23) becomes `inventoryStockId: number`** — this is the
D-01/D-07 FK conversion. `toItemRows` (lines 26-41) currently passes `lotBatch: item.lotBatch` straight
through into the Prisma create row (line 38); change to `inventoryStockId: item.inventoryStockId`.

**Guard-call insertion point — `create` (lines 89-125), inside the `run` closure right after the
existing `assertProductsNotBlockedTx` call (line 104) and before `tx.salesOrder.create` (line 107):**
```typescript
await assertProductsNotBlockedTx(tx as Prisma.TransactionClient, data.items.map((i) => i.productId));
const licenseFields = await validateAndSnapshotLicense(tx as Prisma.TransactionClient, data.customerId, data.customerLicenseId);
// NEW:
await assertLotQuantityTx(tx as Prisma.TransactionClient, data.items);
const { requiresApproval } = await assertCreditAndDiscountTx(tx as Prisma.TransactionClient, data.customerId, orderTotals(rows).netValue, data.items);
```
Same insertion pattern applies to `update` (lines 127-184), following the identical
`assertProductsNotBlockedTx` call site at line 155.

**`createStockOutTx` (lines 49-61)** must now pass `inventoryStockId: item.inventoryStockId` into
`createStockTransactionTx`'s `data` object so the new column (D-08) is populated on every sales-side
stock-OUT transaction:
```typescript
const createStockOutTx = async (tx: Prisma.TransactionClient, orderNo: string, items: SalesOrderItemInput[]) => {
  const referenceNo = salesOrderStockReference(orderNo);
  for (const [index, item] of items.entries()) {
    await createStockTransactionTx(tx, {
      transactionNo: `${referenceNo}-${index + 1}`,
      productId: item.productId,
      transactionType: "OUT",
      quantity: item.quantity,
      referenceNo,
      inventoryStockId: item.inventoryStockId, // NEW
      note: `Auto-generated from sales order ${orderNo}`,
    });
  }
};
```

**`updatedById` tracking (D-09):** add `updatedById?: number` to the `update()` data param (mirrors
existing `createdById?: number` in `create()`, line 98) and pass it through to `tx.salesOrder.update`'s
`data`. Controller supplies `req.userId`, same as `createSalesOrder` already does for `createdById`
(see controller pattern below).

---

### `apps/backend/src/models/importOrder.model.ts` (service/model, CRUD)

**Analog:** itself — extend in place (already read in full, 172 lines)

**Gate stock-IN behind `status === "RECEIVED"` (D-04) — current unconditional call in `create`
(lines 86-109):**
```typescript
const run = async (tx: Client) => {
  await assertProductsNotBlockedTx(tx as Prisma.TransactionClient, data.items.map((i) => i.productId));
  const order = await tx.importOrder.create({ data: { /* ... */ }, include: withRelations });
  await createStockInTx(tx as Prisma.TransactionClient, data.orderNo, data.items); // <- currently unconditional
  return order;
};
```
Change to `if (data.status === "RECEIVED") { await createOrUpdateLotsFromReceivingTx(tx, order, data.items); }`
— replacing the flat `createStockInTx` call with the new lot-aware receiving function (see RESEARCH.md
Architecture Diagram "Import-order receiving flow" for the exact shape:
`createOrUpdateLotsFromReceivingTx` creates one `InventoryStock` row per item then calls
`createStockTransactionTx(tx, { type: IN, inventoryStockId: newLot.inventoryStockId, ... })`).

Same gating logic applies to `update()` (lines 113-159) when `status` transitions to `RECEIVED`.

**D-10 — reject item edits once `RECEIVED` (reuses the existing 404/400 `HttpError` idiom already in
this file, e.g. line 137):**
```typescript
const existing = await tx.importOrder.findUnique({ where: { importOrderId }, select: { orderNo: true, status: true } });
if (!existing) throw new HttpError(404, "Import order not found");
if (existing.status === "RECEIVED") {
  throw new HttpError(400, "Cannot edit items on a received import order; use a stock-adjustment instead");
}
```

---

### `apps/backend/src/models/inventoryStock.model.ts` (service/model, CRUD)

**Analog:** itself (already read in full, 47 lines) — currently has NO transaction-guard shape at all
(plain `prisma.x` calls, no `Client` polymorphic type, no guard function). This is the weakest existing
match in the codebase; use `stockTransaction.model.ts`'s `delete` method (lines 72-82) as the shape
template for the new `adjustStockTx` since it's the closest "mutate + audit-adjacent write" pattern:

```typescript
// Source: apps/backend/src/models/stockTransaction.model.ts lines 72-82 (verified) — template for adjustStockTx
delete: (transactionId: number, client: Client = prisma) => {
  const run = async (tx: Client) => {
    const transaction = await tx.stockTransaction.delete({ where: { transactionId } });
    await tx.product.update({
      where: { productId: transaction.productId },
      data: { stockQty: { increment: -stockDelta(transaction.transactionType, transaction.quantity) } },
    });
    return transaction;
  };
  return "$transaction" in client ? client.$transaction((tx) => run(tx)) : run(client);
},
```
**Build `adjustStockTx` in this shape:**
```typescript
export interface StockAdjustmentInput {
  inventoryStockId: number;
  delta: number; // signed: positive = add, negative = remove
  reasonCode: "DAMAGE" | "THEFT" | "RECOUNT" | "EXPIRY" | "CORRECTION" | "OTHER";
  note?: string;
}

export const adjustStockTx = async (tx: Prisma.TransactionClient, data: StockAdjustmentInput) => {
  const lot = await tx.inventoryStock.findUnique({ where: { inventoryStockId: data.inventoryStockId } });
  if (!lot) throw new HttpError(404, `Inventory lot ${data.inventoryStockId} not found`);
  if (lot.quantityOnHand + data.delta < 0) {
    throw new HttpError(400, `Adjustment would make quantity negative for lot ${lot.lotBatch}`);
  }
  const updated = await tx.inventoryStock.update({
    where: { inventoryStockId: data.inventoryStockId },
    data: { quantityOnHand: { increment: data.delta } },
  });
  return { before: lot, after: updated };
};
```
Call site in a new controller action wraps this with `AuditLogModel.record` exactly like
`approveSalesOrder` wraps its update (see controller pattern below) — `entity: "InventoryStock"`,
`action: "adjust"`, `before`/`after` from `adjustStockTx`'s return.

**D-06 — remove `quantityOnHand` from the generic `update()`'s writable fields (currently line 39,
`inventoryStock.model.ts`):** delete `quantityOnHand: optionalNumber(quantityOnHand),` from the
`update` data object in both the model and `inventoryStock.controller.ts`'s `updateInventoryStock`
(line 67 of that controller file).

---

### `apps/backend/src/controllers/salesOrder.controller.ts` (controller, request-response)

**Analog:** itself (already read in full, 181 lines)

**`parseItems` (lines 8-26) — swap `lotBatch` for `inventoryStockId`, add ENFORCE-05 numeric
validation in the same style:**
```typescript
const parseItems = (value: unknown): SalesOrderItemInput[] => {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError(400, "items must be a non-empty array of { productId, quantity, unitPrice, discount, inventoryStockId }");
  }
  return value.map((raw) => {
    const { productId, quantity, unitPrice, discount, taxRate, inventoryStockId } = raw as Record<string, unknown>;
    if (productId == null || quantity == null || unitPrice == null || discount == null || !inventoryStockId) {
      throw new HttpError(400, "each item requires productId, quantity, unitPrice, discount, and inventoryStockId");
    }
    const qty = Number(quantity);
    const price = Number(unitPrice);
    const disc = Number(discount);
    // NEW (ENFORCE-05): explicit range checks, same lowercase-matchable wording convention as
    // stockTransaction.model.ts's "insufficient" messages
    if (qty <= 0) throw new HttpError(400, "quantity must be a positive number");
    if (price < 0) throw new HttpError(400, "unitPrice must not be negative");
    if (disc < 0 || disc > 100) throw new HttpError(400, "discount must be between 0 and 100");
    return {
      productId: Number(productId),
      quantity: qty,
      unitPrice: price,
      discount: disc,
      taxRate: taxRate == null ? 0 : Number(taxRate),
      inventoryStockId: Number(inventoryStockId),
    };
  });
};
```

**Approve endpoint (lines 130-154) — extend no-self-approval check for `updatedById` (D-09,
ENFORCE-06):**
```typescript
// Current (line 135-137):
if (existing.createdById != null && existing.createdById === req.userId) {
  throw new HttpError(403, "You cannot approve an order you created");
}
// Extend to:
if (existing.createdById != null && existing.createdById === req.userId) {
  throw new HttpError(403, "You cannot approve an order you created");
}
if (existing.updatedById != null && existing.updatedById === req.userId) {
  throw new HttpError(403, "You cannot approve an order you last edited");
}
```
Same extension applies to `rejectSalesOrder` (lines 156-180, same check at 161-163) and to the import
order sibling below.

**Audit-wrapped create/update/delete pattern (lines 38-128)** is already the exact template for the
new stock-adjustment controller action — `prisma.$transaction(async (tx) => { const result = await Model.action(tx); await AuditLogModel.record(tx, {...}); return result; })`.

---

### `apps/backend/src/controllers/importOrder.controller.ts` (controller, request-response)

**Analog:** itself (already read in full, 187 lines) — direct sibling of `salesOrder.controller.ts`,
same `updatedById` extension applies at lines 141-143 (`approveImportOrder`) and 167-169
(`rejectImportOrder`), identical code shape as shown above.

---

### `apps/backend/src/controllers/inventoryStock.controller.ts` + `routes/inventoryStock.routes.ts` (controller + route, request-response)

**Analog:** `apps/backend/src/controllers/salesOrder.controller.ts`'s `approveSalesOrder` (lines
130-154) for the controller shape; `apps/backend/src/routes/salesOrder.routes.ts` line 19 for the
route shape.

**Route pattern (analog, verbatim from `salesOrder.routes.ts` line 19):**
```typescript
salesOrderRoutes.post("/:id/approve", requireAuth, requirePermission("SALES_ORDER_APPROVE"), approveSalesOrder);
```
**New route to add to `inventoryStock.routes.ts` (after line 17):**
```typescript
inventoryStockRoutes.post("/:id/adjust", requireAuth, requirePermission("INVENTORY_ADJUST"), adjustInventoryStock);
```
(Permission code `INVENTORY_ADJUST` is new — mirrors the existing `INVENTORY_VIEW/CREATE/EDIT/DELETE`
naming convention already used in this same routes file, lines 14-18; gate it to the
Warehouse-officer role per D-06.)

**Controller pattern (new `adjustInventoryStock`, modeled on `approveSalesOrder`'s
audit-wrapped-single-action shape, lines 130-154):**
```typescript
export const adjustInventoryStock = asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { delta, reasonCode, note } = req.body;
  if (delta == null || !reasonCode) throw new HttpError(400, "delta and reasonCode are required");
  const result = await prisma.$transaction(async (tx) => {
    const { before, after } = await adjustStockTx(tx, {
      inventoryStockId: Number(req.params.id),
      delta: Number(delta),
      reasonCode,
      note,
    });
    await AuditLogModel.record(tx, {
      entity: "InventoryStock",
      entityId: after.inventoryStockId,
      action: "adjust",
      userId: req.userId ?? null,
      before: { ...before, reasonCode, note },
      after,
    });
    return after;
  });
  res.json(result);
});
```

---

### `apps/frontend/src/pages/SalesOrdersPage.tsx` (component, request-response)

**Analog:** itself — existing lot `<select>` (lines 505-525, grep-verified) already renders
`InventoryStock` records; only the submitted value changes.

**Current (submits `lotBatch` string, line 178 & 218 payload construction, line 521-522 option
value):**
```tsx
<option key={l.inventoryStockId} value={l.lotBatch}>
  {l.lotBatch} ({l.quantityOnHand} · {l.warehouse})
</option>
```
and payload at line 218: `lotBatch: item.lotBatch,`

**Change:** option `value={l.inventoryStockId}` (keep label text as-is), and payload becomes
`inventoryStockId: Number(item.inventoryStockId),` — the `ItemRow` type at line 22
(`lotBatch: string`) becomes `inventoryStockId: string` (still a string in local form state, coerced
to `Number` at submit, matching how `productId`/`quantity`/`unitPrice` are already handled elsewhere
in this same file's submit path, lines 211-219).

## Shared Patterns

### Transaction-scoped guard function (all new business-rule checks)
**Source:** `apps/backend/src/utils/licenseGate.ts` (full file)
**Apply to:** `lotGate.ts`, `creditDiscountGate.ts` — signature `(tx: Prisma.TransactionClient, ...args) => Promise<void | data>`, throw `HttpError(400/404, ...)` on violation, called from inside the model's existing `run` closure before the mutating write.

### Polymorphic `Client` type + `run` closure
**Source:** `apps/backend/src/models/stockTransaction.model.ts` line 6 and the `create`/`delete`
methods (lines 67-82); identically used in `salesOrder.model.ts` line 9 and `importOrder.model.ts`
line 8.
**Apply to:** Any new exported model function this phase adds (`adjustStockTx`,
`createOrUpdateLotsFromReceivingTx`) must accept `client: Client = prisma` and use
`"$transaction" in client ? client.$transaction((tx) => run(tx)) : run(client)` so it composes inside
controller-level transactions.

### Audit-wrapped controller action
**Source:** `apps/backend/src/controllers/salesOrder.controller.ts` `createSalesOrder`/`approveSalesOrder`
(lines 38-71, 130-154)
**Apply to:** All controller files — `prisma.$transaction(async (tx) => { const result = await Model.x(tx); await AuditLogModel.record(tx, { entity, entityId, action, userId: req.userId ?? null, before, after }); return result; })`.

### `requirePermission` route gate
**Source:** `apps/backend/src/middleware/permission.ts` (full file, 23 lines) +
`apps/backend/src/routes/salesOrder.routes.ts` (full file, 23 lines)
**Apply to:** New `POST /:id/adjust` route and any new permission codes — `requireAuth,
requirePermission("<CODE>")` middleware chain, same order every time.

### No-self-approval check
**Source:** `apps/backend/src/controllers/salesOrder.controller.ts` lines 135-137 (and the
`importOrder.controller.ts` sibling at lines 141-143)
**Apply to:** Extend both approve and reject actions on both controllers with the `updatedById`
branch (D-09) — see Pattern Assignments above for exact code.

### Test fixture conventions
**Source:** `apps/backend/tests/salesOrder.license-block.test.ts` and
`apps/backend/tests/order.noSelfApproval.test.ts` (both read in full through `beforeAll`)
**Apply to:** All new Wave-0 test files listed in RESEARCH.md's "Wave 0 Gaps" — real Express `app` via
`supertest`, `createTestUserWithRoles(suffix, roleCodes)`, `Date.now()`-suffixed unique codes for
category/supplier/product/customer, cleanup in `afterAll`, and lowercase-substring error assertions
(`res.body.error.toLowerCase()).toContain("insufficient")` etc.).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/backend/src/utils/rounding.ts` (or wherever the "round-half-up to 2 decimals" helper lands) | utility | transform | Grepped `apps/backend/src` for `round`/`toFixed(2)` — no existing rounding utility found; current code (`salesOrder.model.ts` `toItemRows`/`orderTotals`, `importOrder.model.ts` same) does raw floating-point arithmetic on values coerced from Prisma `Decimal`. CONTEXT.md's "Rounding" section says this was "already resolved" in a prior phase, but no corresponding backend utility exists in this codebase as of this session — planner should either locate it in an untouched file this research missed, or treat introducing `roundHalfUp(value, 2)` as a small new-utility task this phase, referenced by RESEARCH.md's Common Pitfall 5 and the new `assertCreditAndDiscountTx` guard. |
| `apps/backend/src/models/inventoryStock.model.ts`'s pre-existing shape | service/model | CRUD | Not "no analog" in the sense of missing precedent elsewhere in the repo (see `stockTransaction.model.ts`'s `delete` used as template above), but flagged because this file currently has zero guard/audit/transaction-composition patterns of its own — it is the least-evolved model file being touched this phase, so more deviation from a single clean analog is expected. |

## Metadata

**Analog search scope:** `apps/backend/src/{models,controllers,routes,middleware,utils,lib}`,
`apps/backend/prisma/schema.prisma`, `apps/backend/tests/*.test.ts`, `apps/frontend/src/pages/SalesOrdersPage.tsx`
**Files scanned:** 13 read in full (stockTransaction.model.ts, licenseGate.ts, stockReference.ts,
salesOrder.model.ts, importOrder.model.ts, salesOrder.controller.ts, importOrder.controller.ts,
inventoryStock.controller.ts, inventoryStock.model.ts, permission.ts, audit.ts,
inventoryStock.routes.ts, salesOrder.routes.ts) + 2 test files (partial) + schema.prisma (targeted
200-line read covering all 7 relevant models) + 1 frontend grep pass
**Pattern extraction date:** 2026-09-15
