import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./setup.js";
import { assertCreditAndDiscountTx } from "../src/utils/creditDiscountGate.js";
import { HttpError } from "../src/middleware/errorHandler.js";

describe("assertCreditAndDiscountTx", () => {
  const createdCustomerIds: number[] = [];

  afterAll(async () => {
    await prisma.customer.deleteMany({ where: { customerId: { in: createdCustomerIds } } });
  });

  const createCustomer = async (
    suffix: string,
    overrides: Partial<{ creditLimit: number; currentBalance: number; standardDiscount: number }> = {},
  ) => {
    const customer = await prisma.customer.create({
      data: {
        customerCode: `TEST_CDG_CUST_${suffix}_${Date.now()}`,
        customerName: `Credit/Discount Gate Test Customer ${suffix}`,
        channelType: "RETAIL",
        creditLimit: overrides.creditLimit ?? 10000,
        currentBalance: overrides.currentBalance ?? 0,
        availableCredit: (overrides.creditLimit ?? 10000) - (overrides.currentBalance ?? 0),
        standardDiscount: overrides.standardDiscount ?? 10,
        creditStatus: "GOOD",
      },
    });
    createdCustomerIds.push(customer.customerId);
    return customer;
  };

  it("returns requiresApproval: false when projected balance is within creditLimit and discounts are within standardDiscount", async () => {
    const customer = await createCustomer("ok", { creditLimit: 10000, currentBalance: 0, standardDiscount: 10 });

    const result = await prisma.$transaction((tx) =>
      assertCreditAndDiscountTx(tx, customer.customerId, [{ quantity: 10, unitPrice: 10, discount: 5 }]),
    );

    expect(result).toEqual({ requiresApproval: false });
  });

  it("returns requiresApproval: true (does not throw) when projected balance exceeds creditLimit", async () => {
    const customer = await createCustomer("overcredit", { creditLimit: 100, currentBalance: 0, standardDiscount: 10 });

    const result = await prisma.$transaction((tx) =>
      assertCreditAndDiscountTx(tx, customer.customerId, [{ quantity: 100, unitPrice: 10, discount: 0 }]),
    );

    expect(result).toEqual({ requiresApproval: true });
  });

  it("returns requiresApproval: true (does not throw) when an item's discount exceeds standardDiscount", async () => {
    const customer = await createCustomer("overdiscount", { creditLimit: 10000, currentBalance: 0, standardDiscount: 5 });

    const result = await prisma.$transaction((tx) =>
      assertCreditAndDiscountTx(tx, customer.customerId, [{ quantity: 1, unitPrice: 10, discount: 10 }]),
    );

    expect(result).toEqual({ requiresApproval: true });
  });

  it("throws HttpError 404 when customerId does not exist", async () => {
    await expect(
      prisma.$transaction((tx) => assertCreditAndDiscountTx(tx, 999999999, [{ quantity: 1, unitPrice: 10, discount: 0 }])),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("throws an HttpError instance (not a generic error) for a missing customer", async () => {
    try {
      await prisma.$transaction((tx) => assertCreditAndDiscountTx(tx, 999999998, []));
      throw new Error("expected rejection");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
    }
  });
});
