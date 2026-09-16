import { describe, expect, it } from "vitest";
import { assertImportValueThresholdTx, IMPORT_ORDER_APPROVAL_THRESHOLD } from "../src/utils/importValueGate.js";

describe("assertImportValueThresholdTx", () => {
  it("returns requiresApproval: false when totalValue is below the threshold", () => {
    expect(assertImportValueThresholdTx(IMPORT_ORDER_APPROVAL_THRESHOLD - 1)).toEqual({ requiresApproval: false });
  });

  it("returns requiresApproval: false when totalValue exactly equals the threshold (boundary is exclusive)", () => {
    expect(assertImportValueThresholdTx(IMPORT_ORDER_APPROVAL_THRESHOLD)).toEqual({ requiresApproval: false });
  });

  it("returns requiresApproval: true when totalValue exceeds the threshold", () => {
    expect(assertImportValueThresholdTx(IMPORT_ORDER_APPROVAL_THRESHOLD + 1)).toEqual({ requiresApproval: true });
  });

  it("never throws for any numeric input, including 0 and negative values", () => {
    expect(() => assertImportValueThresholdTx(0)).not.toThrow();
    expect(() => assertImportValueThresholdTx(-100)).not.toThrow();
  });
});
