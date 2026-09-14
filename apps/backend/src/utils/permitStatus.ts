export type PermitBucket = "PREPARATION" | "NOTIFY" | "WARNING" | "IMPORTANT_WARNING" | "EXPIRED" | "NORMAL";

export function computePermitStatus(
  expiryDate: Date,
  today: Date = new Date()
): { daysRemaining: number; status: PermitBucket } {
  const d = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const e = Date.UTC(expiryDate.getUTCFullYear(), expiryDate.getUTCMonth(), expiryDate.getUTCDate());
  const daysRemaining = Math.round((e - d) / 86400000);
  let status: PermitBucket;
  if (daysRemaining < 0) status = "EXPIRED";
  else if (daysRemaining <= 30) status = "IMPORTANT_WARNING";
  else if (daysRemaining <= 60) status = "WARNING";
  else if (daysRemaining <= 90) status = "NOTIFY";
  else if (daysRemaining <= 120) status = "PREPARATION";
  else status = "NORMAL";
  return { daysRemaining, status };
}
