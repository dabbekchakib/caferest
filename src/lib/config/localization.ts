import type { SettingsMap } from "@/types/settings";
import { settingValue } from "./settings";

export interface ResolvedLocalization {
  defaultLocale: string;
  availableLocales: string[];
  timezone: string;
  dateFormat: string;
  timeFormat: string;
  numberFormat: string;
  firstDayOfWeek: number;
  /** Resolved RTL: 'auto' means derive from defaultLocale. */
  rtl: boolean;
}

/** Locales whose writing system is inherently right-to-left. */
const RTL_LOCALES = new Set(["ar"]);

/** Resolve localization settings and compute the effective RTL flag. */
export function getLocalizationSettings(
  map: SettingsMap
): ResolvedLocalization {
  const defaultLocale = settingValue<string>(
    map,
    "localization.default_locale",
    "fr"
  );
  const rtlSetting = settingValue<string | boolean>(
    map,
    "localization.rtl_enabled",
    "auto"
  );

  let rtl: boolean;
  if (rtlSetting === "auto") {
    rtl = RTL_LOCALES.has(defaultLocale);
  } else {
    rtl = rtlSetting === true || rtlSetting === "true";
  }

  const rawLocales = settingValue<unknown[] | string>(
    map,
    "localization.available_locales",
    ["fr", "en", "ar"]
  );

  const availableLocales = Array.isArray(rawLocales)
    ? rawLocales.map(String)
    : String(rawLocales)
        .replace(/^\[|\]$/g, "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

  return {
    defaultLocale,
    availableLocales,
    timezone: settingValue<string>(map, "localization.timezone", "UTC"),
    dateFormat: settingValue<string>(
      map,
      "localization.date_format",
      "DD/MM/YYYY"
    ),
    timeFormat: settingValue<string>(map, "localization.time_format", "HH:mm"),
    numberFormat: settingValue<string>(
      map,
      "localization.number_format",
      "fr-TN"
    ),
    firstDayOfWeek: settingValue<number>(
      map,
      "localization.first_day_of_week",
      1
    ),
    rtl,
  };
}
