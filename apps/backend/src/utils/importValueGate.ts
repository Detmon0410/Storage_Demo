// Mirrors the shape of apps/backend/src/utils/creditDiscountGate.ts's assertCreditAndDiscountTx —
// a soft-block guard that never throws; the caller (importOrder.model.ts) maps the result to
// OrderStatus.PENDING_APPROVAL / OrderStatus.APPROVED.
//
// [ASSUMED] 50,000 (JPY) is a placeholder threshold — no source document in this repo specifies a
// real import-order approval threshold (see RESEARCH.md Assumptions Log A1). Tune here; this is the
// single source of truth referenced only by importOrder.model.ts.
export const IMPORT_ORDER_APPROVAL_THRESHOLD = 50_000;

export const assertImportValueThresholdTx = (totalValue: number) => ({
  requiresApproval: totalValue > IMPORT_ORDER_APPROVAL_THRESHOLD,
});
