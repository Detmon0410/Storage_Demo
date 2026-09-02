import i18n from "../i18n";

function activeLocale(): string {
  return i18n.language?.startsWith("ja") ? "ja-JP" : "en-US";
}

export function formatNumber(value: string | number | null | undefined, digits = 0): string {
  if (value == null || value === "") return "-";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "-";
  return num.toLocaleString(activeLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  JPY: "¥",
  THB: "฿",
  USD: "$",
  EUR: "€",
};

export function formatCurrency(value: string | number | null | undefined, currency = "JPY"): string {
  if (value == null || value === "") return "-";
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "-";
  const symbol = CURRENCY_SYMBOLS[currency] ?? `${currency} `;
  const digits = currency === "JPY" ? 0 : 2;
  return `${symbol}${num.toLocaleString(activeLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(activeLocale(), { year: "numeric", month: "short", day: "2-digit", timeZone: "UTC" });
}

export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  return value.slice(0, 10);
}
