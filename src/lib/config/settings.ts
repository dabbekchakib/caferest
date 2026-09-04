import type { Json } from "@/types/database";
import type {
  SettingGroup,
  SettingType,
} from "@/types/database";
import type {
  SettingEntry,
  SettingsMap,
  TypedSettingValue,
} from "@/types/settings";

/** Default settings for a fresh establishment (idempotent baseline). */
export const SETTING_GROUPS: SettingGroup[] = [
  "general",
  "branding",
  "localization",
  "currency",
  "tax",
  "pos",
  "inventory",
  "purchasing",
  "recipes",
  "printing",
  "notifications",
  "security",
  "customers",
  "kitchen",
  "system",
];

/**
 * Parse a raw string setting value into its typed representation.
 * Falls back to the raw string when parsing fails.
 */
export function parseSettingValue(
  value: string | null,
  type: SettingType
): TypedSettingValue {
  if (value === null) {
    switch (type) {
      case "boolean":
        return false;
      case "integer":
      case "decimal":
        return 0;
      default:
        return "";
    }
  }

  switch (type) {
    case "boolean":
      return value === "true" || value === "1" || value.toLowerCase() === "yes";
    case "integer":
    case "decimal": {
      const num = Number(value);
      return Number.isNaN(num) ? 0 : num;
    }
    case "json":
      try {
        return JSON.parse(value) as TypedSettingValue;
      } catch {
        return value;
      }
    default:
      return value;
  }
}

/** Serialize a typed value back to its raw string for storage. */
export function serializeSettingValue(
  value: TypedSettingValue | Json
): string {
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string" || typeof value === "bigint") return String(value);
  return JSON.stringify(value);
}

/** Convert a raw DB settings row into a typed SettingEntry. */
export function toSettingEntry(raw: {
  key: string;
  value: string | null;
  type: SettingType;
  group_name: SettingGroup;
  description: string | null;
  is_public: boolean;
}): SettingEntry {
  return {
    key: raw.key,
    value: raw.value,
    type: raw.type,
    group: raw.group_name,
    description: raw.description,
    isPublic: raw.is_public,
  };
}

/** Build a key -> typed value map from a list of setting entries. */
export function toSettingsMap(entries: SettingEntry[]): SettingsMap {
  return entries.reduce<SettingsMap>((acc, entry) => {
    acc[entry.key] = parseSettingValue(entry.value, entry.type);
    return acc;
  }, {});
}

/** Extract a typed value from a settings map, with a default fallback. */
export function settingValue<T extends TypedSettingValue>(
  map: SettingsMap,
  key: string,
  fallback: T
): T {
  const value = map[key];
  return (value === undefined || value === null ? fallback : value) as T;
}
