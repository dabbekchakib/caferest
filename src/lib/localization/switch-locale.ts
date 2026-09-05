"use client";

import { isLocale, type Locale } from "@/i18n/routing";
import { writeLocaleCookie, applyHtmlDirection } from "./persistence";

/** Minimal shape of the App Router instance returned by `useRouter()`. */
interface RefreshRouter {
  refresh: () => void;
}

export interface SwitchLocaleOptions {
  /** Persist to the user's Supabase profile. */
  persist?: boolean;
  /** Refresh server components after switching (re-run RSC with new cookie). */
  refresh?: boolean;
  /** Router instance to refresh server-rendered content (provided by the caller). */
  router?: RefreshRouter;
}

/**
 * Apply a locale change on the client:
 *  - update the Zustand store (reactive re-render)
 *  - set the NEXT_LOCALE cookie
 *  - apply <html lang/dir> immediately
 *  - persist the preference to the user's profile (async)
 *  - optionally refresh server-rendered content
 *
 * Falls back gracefully when not authenticated (cookie-only session).
 */
export async function switchLocale(
  target: Locale | string,
  setStoreLocale: (locale: Locale) => void,
  opts: SwitchLocaleOptions = {}
): Promise<void> {
  if (!isLocale(target)) return;
  const locale = target;

  setStoreLocale(locale);
  writeLocaleCookie(locale);
  applyHtmlDirection(locale);

  if (opts.persist) {
    const { persistPreferredLocale } = await import("./locale-service");
    const { createClient } = await import("@/lib/supabase/client");
    try {
      await persistPreferredLocale(createClient(), locale);
    } catch {
      /* ignore auth/network errors — cookie still applies */
    }
  }

  if (opts.refresh && opts.router) {
    opts.router.refresh();
  }
}
