import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getLocalizationSettings } from "@/lib/config/localization";
import { getActiveEstablishmentId, getSettingsMap } from "@/services/settings";
import { isLocale, defaultLocale, locales, type Locale } from "@/i18n/routing";

type Client = SupabaseClient<Database>;

export interface ResolvedLocales {
  defaultLocale: Locale;
  /** Locales currently enabled in the establishment config. */
  availableLocales: Locale[];
}

const ALL_LOCALES: Locale[] = [...locales];
const DEFAULT_RESOLVED: ResolvedLocales = {
  defaultLocale,
  availableLocales: ALL_LOCALES,
};

/**
 * Read the establishment locale configuration (default + available locales)
 * from the settings table. Gracefully falls back to FR when Supabase is not
 * reachable or the data is missing.
 */
export async function getEstablishmentLocales(
  client: Client,
  userId: string
): Promise<ResolvedLocales> {
  try {
    const establishmentId = await getActiveEstablishmentId(client, userId);
    if (!establishmentId) return DEFAULT_RESOLVED;

    const map = await getSettingsMap(client, establishmentId);
    const loc = getLocalizationSettings(map);

    const available = loc.availableLocales.filter(isLocale) as Locale[];
    const defaultL = isLocale(loc.defaultLocale)
      ? loc.defaultLocale
      : defaultLocale;

    return {
      defaultLocale: defaultL,
      availableLocales: available.length > 0 ? available : ALL_LOCALES,
    };
  } catch {
    return DEFAULT_RESOLVED;
  }
}

/**
 * Persist the user's chosen locale to their profile (auth required).
 * Returns false when not authenticated — callers may still fall back to a
 * cookie-only session.
 */
export async function persistPreferredLocale(
  client: Client,
  locale: Locale
): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) return false;

    const { error } = await client
      .from("profiles")
      .update({ preferred_locale: locale })
      .eq("id", user.id);
    return !error;
  } catch {
    return false;
  }
}
