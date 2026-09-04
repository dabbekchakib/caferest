import type { SettingsMap } from "@/types/settings";
import { settingValue } from "./settings";

/** Resolve branding colors + theme from a consolidated settings map. */
export function getBrandingColors(map: SettingsMap) {
  return {
    primaryColor: settingValue<string>(map, "branding.primary_color", "#2563eb"),
    secondaryColor: settingValue<string>(map, "branding.secondary_color", "#7c3aed"),
    accentColor: settingValue<string>(map, "branding.accent_color", "#f59e0b"),
    successColor: settingValue<string>(map, "branding.success_color", "#16a34a"),
    warningColor: settingValue<string>(map, "branding.warning_color", "#d97706"),
    dangerColor: settingValue<string>(map, "branding.danger_color", "#dc2626"),
  };
}

/** Resolve general establishment info referenced by settings. */
export function getGeneralSettings(map: SettingsMap) {
  return {
    name: settingValue<string>(map, "establishment.name", ""),
  };
}

export type ResolvedBranding = ReturnType<typeof getBrandingColors>;
