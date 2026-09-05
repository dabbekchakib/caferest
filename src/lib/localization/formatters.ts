import type { Locale } from "@/i18n/routing";
import type { CurrencyConfig, DateFormatConfig } from "@/types/localization";

/**
 * Centralized localized formatting helpers.
 *
 * These honor the establishment configuration (date/time/number/currency)
 * provided by PHASE 03. When no explicit config is given they fall back to
 * sensible `Intl` defaults for the active locale. Never format manually in
 * individual components — always route through here.
 */

export interface LocalizationFormatters {
  locale: Locale;
  timeZone?: string;
  currency?: CurrencyConfig;
  dates?: DateFormatConfig;
}

const DEFAULT_CURRENCY: CurrencyConfig = {
  code: "TND",
  symbol: "د.ت",
  position: "after",
  decimalPlaces: 3,
  thousandSeparator: ",",
  decimalSeparator: ".",
};

const DEFAULT_DATES: DateFormatConfig = {
  dateFormat: "DD/MM/YYYY",
  timeFormat: "HH:mm",
  timezone: "Africa/Tunis",
  firstDayOfWeek: 1,
};

const dateFormatToIntl: Record<string, Intl.DateTimeFormatOptions> = {
  "DD/MM/YYYY": { day: "2-digit", month: "2-digit", year: "numeric" },
  "MM/DD/YYYY": { month: "2-digit", day: "2-digit", year: "numeric" },
  "YYYY-MM-DD": { year: "numeric", month: "2-digit", day: "2-digit" },
  "DD MMM YYYY": { day: "2-digit", month: "short", year: "numeric" },
  "MMMM DD, YYYY": { month: "long", day: "2-digit", year: "numeric" },
};

function build(opts: LocalizationFormatters) {
  const currency = opts.currency ?? DEFAULT_CURRENCY;
  const dates = opts.dates ?? DEFAULT_DATES;
  const timeZone = opts.timeZone ?? dates.timezone;
  const locale = opts.locale;

  const dateOptions: Intl.DateTimeFormatOptions =
    dateFormatToIntl[dates.dateFormat] ?? dateFormatToIntl["DD/MM/YYYY"];

  const timeOptions: Intl.DateTimeFormatOptions =
    dates.timeFormat === "HH:mm"
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : { hour: "2-digit", minute: "2-digit", hour12: true };

  const number = (value: number, opts?: Intl.NumberFormatOptions) =>
    new Intl.NumberFormat(locale, opts).format(value);

  return {
    formatDate: (date: Date | string | number) => {
      const d = new Date(date);
      return new Intl.DateTimeFormat(locale, {
        ...dateOptions,
        timeZone,
      }).format(d);
    },
    formatTime: (date: Date | string | number) => {
      const d = new Date(date);
      return new Intl.DateTimeFormat(locale, timeOptions).format(d);
    },
    formatDateTime: (date: Date | string | number) => {
      const d = new Date(date);
      return new Intl.DateTimeFormat(locale, {
        ...dateOptions,
        ...timeOptions,
        timeZone,
      }).format(d);
    },
    formatNumber: (value: number, opts?: Intl.NumberFormatOptions) =>
      number(value, opts),
    formatInteger: (value: number) =>
      number(value, { maximumFractionDigits: 0 }),
    formatQuantity: (value: number, opts?: Intl.NumberFormatOptions) =>
      number(value, { maximumFractionDigits: 3, ...opts }),
    formatPercentage: (value: number, showSign = false) => {
      const sign = showSign && value >= 0 ? "+" : "";
      return `${sign}${new Intl.NumberFormat(locale, {
        maximumFractionDigits: 1,
      }).format(value)}%`;
    },
    formatCurrency: (value: number) => {
      const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: currency.decimalPlaces,
        maximumFractionDigits: currency.decimalPlaces || 0,
      }).format(value);
      if (currency.position === "before") {
        return `${currency.symbol} ${formatted}`;
      }
      return `${formatted} ${currency.symbol}`;
    },
  };
}

export function createFormatters(opts: LocalizationFormatters) {
  return build(opts);
}
