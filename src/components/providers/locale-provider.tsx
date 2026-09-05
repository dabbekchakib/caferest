"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { getClientMessages } from "@/i18n/client-messages";
import { getDirection } from "@/i18n/routing";
import { applyHtmlDirection } from "@/lib/localization/persistence";
import { switchLocale } from "@/lib/localization/switch-locale";
import { LocaleContext, type LocaleContextValue } from "./locale-context";

const FALLBACK_AVAILABLE: Locale[] = ["fr", "en", "ar"];

export interface LocaleProviderProps {
  initialLocale: Locale;
  children: React.ReactNode;
}

export function LocaleProvider({
  initialLocale,
  children,
}: LocaleProviderProps) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [availableLocales, setAvailableLocales] =
    useState<Locale[]>(FALLBACK_AVAILABLE);

  // Apply <html dir/lang> and refine locales from Supabase once mounted.
  useEffect(() => {
    applyHtmlDirection(locale);
  }, [locale]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { createClient } = await import("@/lib/supabase/client");
        const { getEstablishmentLocales } =
          await import("@/lib/localization/locale-service");
        const client = createClient();
        const {
          data: { user },
        } = await client.auth.getUser();
        if (!user) return;
        const resolved = await getEstablishmentLocales(client, user.id);
        if (cancelled) return;
        setAvailableLocales(resolved.availableLocales);
      } catch {
        /* Supabase unavailable — keep code defaults */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      direction: getDirection(locale),
      isRTL: getDirection(locale) === "rtl",
      availableLocales,
      setLocale: (target, opts) => {
        void switchLocale(target, setLocaleState, {
          persist: opts?.persist ?? true,
          refresh: opts?.refresh ?? true,
          router,
        });
      },
    }),
    [locale, availableLocales, router]
  );

  return (
    <LocaleContext.Provider value={value}>
      <NextIntlClientProvider
        locale={locale}
        messages={getClientMessages(locale)}
      >
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
