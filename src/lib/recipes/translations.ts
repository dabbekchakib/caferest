import type {
  RecipeLocale,
  RecipeTranslation,
  RecipeTranslationsMap,
} from "./types";

/** Buckets translation rows by recipe, then by locale. */
export function groupRecipeTranslations(
  rows: RecipeTranslation[]
): Record<string, RecipeTranslationsMap> {
  const grouped: Record<string, RecipeTranslationsMap> = {};
  for (const row of rows) {
    const locale = row.locale as RecipeLocale;
    const bucket = grouped[row.recipe_id] ?? (grouped[row.recipe_id] = {});
    if (bucket[locale]) continue;
    bucket[locale] = {
      name: row.name,
      description: row.description,
      notes: row.notes,
    };
  }
  return grouped;
}

/**
 * Resolves the display name. The master (`recipes.name`) is the French name:
 *   - fr or unknown locale → master (never a foreign translation)
 *   - en → en translation ?? master
 *   - ar → ar translation ?? en ?? master
 */
export function resolveRecipeName(
  master: string,
  translations: RecipeTranslationsMap,
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

/** Resolves the description with the same per-locale chain as the name. */
export function resolveRecipeDescription(
  master: string | null,
  translations: RecipeTranslationsMap,
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

/** Resolves the notes with the same per-locale chain as the name. */
export function resolveRecipeNotes(
  master: string | null,
  translations: RecipeTranslationsMap,
  locale: string
): string | null {
  if (locale === "en") {
    return translations.en?.notes != null ? translations.en.notes : master;
  }
  if (locale === "ar") {
    if (translations.ar?.notes != null) return translations.ar.notes;
    if (translations.en?.notes != null) return translations.en.notes;
    return master;
  }
  return master;
}