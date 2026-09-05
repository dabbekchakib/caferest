import type {
  IngredientLocale,
  IngredientTranslation,
  IngredientTranslationsMap,
} from "./types";

/** Buckets translation rows by ingredient, then by locale. */
export function groupIngredientTranslations(
  rows: IngredientTranslation[]
): Record<string, IngredientTranslationsMap> {
  const grouped: Record<string, IngredientTranslationsMap> = {};
  for (const row of rows) {
    const locale = row.locale as IngredientLocale;
    const bucket = grouped[row.ingredient_id] ?? (grouped[row.ingredient_id] = {});
    if (bucket[locale]) continue;
    bucket[locale] = {
      name: row.name,
      description: row.description,
    };
  }
  return grouped;
}

/**
 * Resolves the display name. The master (`ingredients.name`) is the French
 * name:
 *   - fr or unknown locale → master (never a foreign translation)
 *   - en → en translation ?? master
 *   - ar → ar translation ?? en ?? master
 */
export function resolveIngredientName(
  master: string,
  translations: IngredientTranslationsMap,
  locale: string
): string {
  if (locale === "en") return translations.en?.name ?? master;
  if (locale === "ar") {
    if (translations.ar?.name) return translations.ar.name;
    if (translations.en?.name) return translations.en.name;
    return master;
  }
  return master;
}

/**
 * Resolves the description with the same per-locale chain as the name.
 */
export function resolveIngredientDescription(
  master: string | null,
  translations: IngredientTranslationsMap,
  locale: string
): string | null {
  if (locale === "en") {
    return translations.en?.description != null
      ? translations.en.description
      : master;
  }
  if (locale === "ar") {
    if (translations.ar?.description != null) return translations.ar.description;
    if (translations.en?.description != null) return translations.en.description;
    return master;
  }
  return master;
}