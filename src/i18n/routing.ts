/**
 * i18n routing & locale configuration (next-intl non-routed mode).
 *
 * The application keeps flat URLs (no `[locale]` prefix segment). Locale is
 * resolved per-request from a cookie (`NEXT_LOCALE`), falling back to the
 * establishment default locale, then FR.
 */

export type Locale = "fr" | "en" | "ar";
export type Direction = "ltr" | "rtl";

export const locales = ["fr", "en", "ar"] as const satisfies readonly Locale[];
export type LocaleCode = (typeof locales)[number];

export const defaultLocale = "fr" as const satisfies Locale;

/** Locale metadata: labels + writing direction. */
export const localeMeta: Record<
  Locale,
  { label: string; short: string; direction: Direction; native: string }
> = {
  fr: { label: "Français", short: "FR", direction: "ltr", native: "Français" },
  en: { label: "English", short: "EN", direction: "ltr", native: "English" },
  ar: { label: "العربية", short: "AR", direction: "rtl", native: "العربية" },
};

export const rtlLocales: ReadonlySet<Locale> = new Set<Locale>(["ar"]);

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (locales as readonly string[]).includes(value)
  );
}

export function getDirection(locale: Locale): Direction {
  return localeMeta[locale].direction;
}

export function isRTL(locale: Locale): boolean {
  return getDirection(locale) === "rtl";
}

/** Direction of the pairing locale: used to auto-derive RTL in settings. */
export function rtlEnabledForLocale(locale: string): boolean {
  return rtlLocales.has(locale as Locale);
}

/** Filter a raw (possibly untrusted) value against supported locales. */
export function resolveSupportedLocale(
  value: unknown,
  fallback: Locale = defaultLocale
): Locale {
  return isLocale(value) ? value : fallback;
}
