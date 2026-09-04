import type { Tables } from "@/types/index";

/** Establishment row type for convenience. */
export type Establishment = Tables<"establishments">;

/** Branding / theme colors (configurable, applied to CSS variables). */
export interface BrandingColors {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  successColor: string;
  warningColor: string;
  dangerColor: string;
}

export interface BrandingSettings extends BrandingColors {
  darkMode: "light" | "dark" | "system";
  logoUrl: string | null;
  faviconUrl: string | null;
}

export interface LocalizationSettings {
  defaultLocale: string;
  availableLocales: string[];
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
  firstDayOfWeek: number;
  rtlEnabled: boolean | "auto";
}

export interface CurrencySettings {
  code: string;
  symbol: string;
  position: "before" | "after";
  decimalPlaces: number;
  thousandSeparator: string;
  decimalSeparator: string;
}

export interface TaxSettings {
  defaultRate: number;
}
