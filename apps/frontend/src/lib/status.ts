export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_BY_CODE: Record<string, Tone> = {
  // product.status
  READY: "success",
  LOW_STOCK: "warning",
  OUT_OF_STOCK: "danger",
  SUSPENDED: "danger",
  // importOrder.status
  STAGING: "warning",
  PENDING_APPROVAL: "warning",
  APPROVED: "info",
  CUSTOMS_CLEARED: "info",
  RECEIVED: "success",
  ISSUE: "danger",
  // license.status
  NORMAL: "success",
  EXPIRING_SOON: "warning",
  EXPIRED: "danger",
  // customer.creditStatus
  NEAR_LIMIT: "warning",
  OVER_LIMIT: "danger",
  NO_LICENSE: "danger",
  // salesOrder.deliveryStatus
  PENDING: "warning",
  SHIPPING: "info",
  DELIVERED: "success",
  RETURNED: "danger",
  DAMAGED: "danger",
  // inventoryStock.stockStatus
  AGING_SOON: "warning",
  AGING: "danger",
  // supplier.status
  ACTIVE: "success",
  INACTIVE: "neutral",
  // customerLicense.status
  REVOKED: "danger",
};

export function statusTone(code: string | null | undefined): Tone {
  if (!code) return "neutral";
  return TONE_BY_CODE[code] ?? "neutral";
}

export function trendTone(direction: "up" | "down" | "flat" | null | undefined, isIncreaseGood: boolean): Tone {
  if (!direction || direction === "flat") return "neutral";
  const isGood = direction === "up" ? isIncreaseGood : !isIncreaseGood;
  return isGood ? "success" : "warning";
}
