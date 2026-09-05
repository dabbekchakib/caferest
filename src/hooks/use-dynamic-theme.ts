"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getThemeSettings, themeToCssVariables } from "@/lib/config/theme";
import { getSettingsMap, getActiveEstablishmentId } from "@/services/settings";

/**
 * Loads branding colors from Supabase and applies them as CSS custom
 * properties on the <html> element. Gracefully no-ops when Supabase is not
 * configured or the user has no establishment membership yet, keeping the
 * design-system defaults intact.
 */
export function useDynamicTheme() {
  useEffect(() => {
    let cancelled = false;
    let supabase: ReturnType<typeof createClient> | null = null;

    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anon) return;
      supabase = createClient();
    } catch {
      return;
    }

    void (async () => {
      try {
        if (!supabase) return;
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled || !user) return;

        const establishmentId = await getActiveEstablishmentId(
          supabase,
          user.id
        );
        if (cancelled || !establishmentId) return;

        const map = await getSettingsMap(supabase, establishmentId);
        if (cancelled) return;

        const vars = themeToCssVariables(getThemeSettings(map));
        const root = document.documentElement;
        Object.entries(vars).forEach(([key, value]) => {
          root.style.setProperty(key, value);
        });
      } catch {
        // Supabase not configured or query failed: keep design-system defaults.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
