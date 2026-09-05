import type {
  CategoryTranslationsMap,
  CategoryTranslation,
  CategoryLocale,
} from "./types";
import { isCategoryLocale } from "./types";

/** Group raw translation rows by category id, indexed by locale. */
export function groupTranslations(
  rows: CategoryTranslation[]
): Record<string, CategoryTranslationsMap> {
  const grouped: Record<string, CategoryTranslationsMap> = {};
  for (const row of rows) {
    const existing = grouped[row.category_id] ?? {};
    existing[row.locale as CategoryLocale] = {
      name: row.name,
      description: row.description,
    };
    grouped[row.category_id] = existing;
  }
  return grouped;
}

/**
 * Resolve the best name for a category given the active UI locale.
 *
 * Fallback chain: active locale -> fr -> en -> master column (name).
 */
export function resolveCategoryName(
  name: string,
  translations: CategoryTranslationsMap,
  locale: CategoryLocale | string
): string {
  const map = translations;
  const key = isCategoryLocale(locale) ? locale : null;
  if (key && map[key]?.name) return map[key]!.name;
  if (map.fr?.name) return map.fr.name;
  if (map.en?.name) return map.en.name;
  return name;
}

/**
 * Resolve the best description (nullable) with the same fallback chain.
 */
export function resolveCategoryDescription(
  description: string | null,
  translations: CategoryTranslationsMap,
  locale: CategoryLocale | string
): string | null {
  const map = translations;
  const key = isCategoryLocale(locale) ? locale : null;
  const candidate =
    (key ? map[key]?.description : null) ??
    map.fr?.description ??
    map.en?.description;
  return candidate ?? description;
}

export type { CategoryLocale, CategoryTranslationsMap, CategoryTranslation };