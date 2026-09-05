import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale, type Locale } from "./routing";
import { importMessages } from "./messages";

const DEFAULT_TIMEZONE = "Africa/Tunis";

/**
 * Resolve the locale for the current request.
 *
 * Priority:
 *  1. user preference cookie (NEXT_LOCALE)
 *  2. configured default locale (falls back to FR)
 *
 * Client-side sync (Supabase preferred_locale / available_locales) is handled
 * by the LocaleProvider so that a change never requires a reload.
 */
export function getRequestLocale(cookieValue: string | undefined): Locale {
  return isLocale(cookieValue) ? cookieValue : defaultLocale;
}

export default getRequestConfig(async () => {
  let locale: Locale = defaultLocale;
  try {
    const store = await cookies();
    locale = getRequestLocale(store.get("NEXT_LOCALE")?.value);
  } catch {
    // Static pre-render attempts (e.g. dev/build shell) have no request
    // context. Fall back to the default locale for those renders.
    locale = defaultLocale;
  }
  const messages = importMessages(locale);
  return { locale, messages, timeZone: DEFAULT_TIMEZONE };
});
