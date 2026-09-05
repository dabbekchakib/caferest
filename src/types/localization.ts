import type { Direction, Locale } from "@/i18n/routing";

/** Strong central types for the localization system. */
export type { Direction, Locale };

export interface LocaleConfig {
  defaultLocale: Locale;
  availableLocales: Locale[];
}

export interface CurrencyConfig {
  code: string;
  symbol: string;
  position: "before" | "after";
  decimalPlaces: number;
  thousandSeparator: string;
  decimalSeparator: string;
}

export interface DateFormatConfig {
  dateFormat: string;
  timeFormat: string;
  timezone: string;
  firstDayOfWeek: number;
}
