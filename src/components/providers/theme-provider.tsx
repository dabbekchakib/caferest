"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/stores/use-theme-store";
import { useDynamicTheme } from "@/hooks/use-dynamic-theme";

function applyTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function ThemeProvider() {
  const theme = useThemeStore((state) => state.theme);
  const setResolvedTheme = useThemeStore((state) => state.setResolvedTheme);

  // Apply branded CSS variables from Supabase (no-op until Supabase is set).
  useDynamicTheme();

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function resolve() {
      let resolved: "light" | "dark";
      if (theme === "system") {
        resolved = media.matches ? "dark" : "light";
      } else {
        resolved = theme;
      }
      setResolvedTheme(resolved);
      applyTheme(resolved);
    }

    resolve();
    media.addEventListener("change", resolve);
    return () => media.removeEventListener("change", resolve);
  }, [theme, setResolvedTheme]);

  return null;
}
