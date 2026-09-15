/**
 * Rounds a number to a fixed number of decimals using standard round-half-up semantics
 * (e.g. 2.345 -> 2.35), matching Thai VAT invoice convention. Per-line rounding is applied
 * before summing totals (decision resolved 2026-09-14, see .planning/STATE.md).
 */
export function roundHalfUp(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}
