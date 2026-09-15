import type { Prisma } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler.js";
import { roundHalfUp } from "./rounding.js";

export interface CreditDiscountCheckItem {
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate?: number;
}

export const assertCreditAndDiscountTx = async (
  tx: Prisma.TransactionClient,
  customerId: number,
  items: CreditDiscountCheckItem[],
) => {
  const customer = await tx.customer.findUnique({ where: { customerId } });
  if (!customer) throw new HttpError(404, "Customer not found");

  // Re-derive the order's net value server-side from the submitted items — never trust a
  // client-computed total or a client-submitted requiresApproval flag (RESEARCH.md Anti-Patterns).
  const orderNetValue = items.reduce((sum, item) => {
    const discounted = item.quantity * item.unitPrice * (1 - item.discount / 100);
    const taxAmount = discounted * ((item.taxRate ?? 0) / 100);
    return sum + roundHalfUp(discounted + taxAmount, 2);
  }, 0);

  const projectedBalance = roundHalfUp(Number(customer.currentBalance) + orderNetValue, 2);
  const overCredit = projectedBalance > Number(customer.creditLimit);
  const overDiscount = items.some((item) => item.discount > Number(customer.standardDiscount));

  // D-05: soft-block only — the caller (salesOrder.model.ts) sets SalesOrder.requiresApproval
  // from this result and defers stock decrement; it must NOT throw here (contrast with
  // assertLotQuantityTx/assertProductsNotBlockedTx, which hard-reject).
  return { requiresApproval: overCredit || overDiscount };
};
