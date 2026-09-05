"use client";

import { create } from "zustand";
import { type Locale } from "@/i18n/routing";

interface AppState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  availableLocales: Locale[];
  setAvailableLocales: (locales: Locale[]) => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  toggleMobileNav: () => void;
  sidebarCollapsed: boolean;
  toggleSidebarCollapsed: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  locale: "fr",
  setLocale: (locale) => set({ locale }),
  availableLocales: ["fr", "en", "ar"],
  setAvailableLocales: (locales) =>
    set({
      availableLocales: locales.length > 0 ? locales : ["fr", "en", "ar"],
    }),
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  toggleMobileNav: () =>
    set((state) => ({ mobileNavOpen: !state.mobileNavOpen })),
  sidebarCollapsed: false,
  toggleSidebarCollapsed: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}));
