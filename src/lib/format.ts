export function formatCurrency(value: number, currency = "TND"): string {
  try {
    return new Intl.NumberFormat("fr-TN", {
      style: "currency",
      currency,
      maximumFractionDigits: 3,
    }).format(value);
  } catch {
    return `${value.toFixed(3)} ${currency}`;
  }
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}
