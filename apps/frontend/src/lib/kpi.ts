export type KpiUnit = "DAYS" | "PERCENT" | "JPY" | "ITEMS" | "TIMES" | "SKU";
export type KpiDirection = "lowerIsBetter" | "higherIsBetter" | "neutral";
export type KpiDeltaKind = "absolute" | "percent";

export const KPI_CONFIG: Record<
  string,
  { unit: KpiUnit; direction: KpiDirection; valueDigits: number; deltaKind: KpiDeltaKind }
> = {
  AVG_IMPORT_LEAD_TIME: { unit: "DAYS", direction: "lowerIsBetter", valueDigits: 0, deltaKind: "absolute" },
  STAGING_ERROR_RATE: { unit: "PERCENT", direction: "lowerIsBetter", valueDigits: 1, deltaKind: "absolute" },
  TOTAL_STOCK_VALUE: { unit: "JPY", direction: "neutral", valueDigits: 0, deltaKind: "percent" },
  LICENSES_EXPIRING_SOON: { unit: "ITEMS", direction: "lowerIsBetter", valueDigits: 0, deltaKind: "absolute" },
  MONTHLY_TAX_DUTY_COST: { unit: "JPY", direction: "neutral", valueDigits: 0, deltaKind: "percent" },
  MONTHLY_SALES_TOTAL: { unit: "JPY", direction: "higherIsBetter", valueDigits: 0, deltaKind: "percent" },
  INVENTORY_TURNOVER: { unit: "TIMES", direction: "higherIsBetter", valueDigits: 1, deltaKind: "absolute" },
  AGING_STOCK_COUNT: { unit: "SKU", direction: "lowerIsBetter", valueDigits: 0, deltaKind: "absolute" },
  ON_TIME_DELIVERY_RATE: { unit: "PERCENT", direction: "higherIsBetter", valueDigits: 1, deltaKind: "absolute" },
  TOTAL_OUTSTANDING_CREDIT: { unit: "JPY", direction: "neutral", valueDigits: 0, deltaKind: "percent" },
};

export function trendDirectionOf(deltaValue: number): "up" | "down" | "flat" {
  if (deltaValue > 0) return "up";
  if (deltaValue < 0) return "down";
  return "flat";
}
