// Pure display helpers for purchase orders (NO server/client imports so the
// file stays safe to unit-test under `node --test`).

/** Money with ISO currency (falls back to a plain number + code). */
export function formatMoney(amount: number, currencyCode: string): string {
  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
  } catch {
    return `${amount.toFixed(3)} ${currencyCode}`;
  }
  return formatter.format(amount);
}

/** Short date (e.g. `05 Sep 2026`) or an em dash when missing/invalid. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "\u2014";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "\u2014";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

/** Parses a text input into a finite non-negative number (0 when empty). */
export function parseAmount(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/** Parses a text input into a positive number (validated upstream). */
export function parseQuantity(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}