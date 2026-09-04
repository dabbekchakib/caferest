import type { SettingsMap } from "@/types/settings";
import { getBrandingColors, type ResolvedBranding } from "./establishment";
import { settingValue } from "./settings";

export type ThemeMode = "light" | "dark" | "system";

export interface ResolvedTheme extends ResolvedBranding {
  darkMode: ThemeMode;
}

/** Resolve the dynamic theme (colors + dark mode) from a settings map. */
export function getThemeSettings(map: SettingsMap): ResolvedTheme {
  return {
    ...getBrandingColors(map),
    darkMode: settingValue<ThemeMode>(map, "branding.dark_mode", "system"),
  };
}

/** Map a ResolvedTheme object to CSS custom properties applied on :root. */
export function themeToCssVariables(theme: ResolvedTheme): Record<string, string> {
  return {
    "--color-primary": theme.primaryColor,
    "--color-secondary": theme.secondaryColor,
    "--color-accent": theme.accentColor,
    "--color-success": theme.successColor,
    "--color-warning": theme.warningColor,
    "--color-danger": theme.dangerColor,
  };
}
