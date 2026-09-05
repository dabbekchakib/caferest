"use client";

import { createContext, useContext } from "react";
import type { Direction, Locale } from "@/i18n/routing";

export interface LocaleContextValue {
  locale: Locale;
  direction: Direction;
  isRTL: boolean;
  availableLocales: Locale[];
  /** Switch the UI locale (updates state, cookie, <html dir/lang>, persists). */
  setLocale: (
    locale: Locale,
    opts?: { persist?: boolean; refresh?: boolean }
  ) => void;
}

export const LocaleContext = createContext<LocaleContextValue | null>(null);

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within a <LocaleProvider>.");
  }
  return ctx;
}
