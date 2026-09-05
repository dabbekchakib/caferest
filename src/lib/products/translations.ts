import type {
  ProductLocale,
  ProductTranslation,
  ProductTranslationsMap,
} from "./types";

/** Buckets translation rows by product, then by locale. */
export function groupTranslations(
  rows: ProductTranslation[]
): Record<string, ProductTranslationsMap> {
  const grouped: Record<string, ProductTranslationsMap> = {};
  for (const row of rows) {
    const locale = row.locale as ProductLocale;
    const bucket = grouped[row.product_id] ?? (grouped[row.product_id] = {});
    if (bucket[locale]) continue;
    bucket[locale] = {
      name: row.name,
      shortDescription: row.short_description,
      description: row.description,
    };
  }
  return grouped;
}

/**
 * Resolves the display name. The master (`products.name`) is the French name:
 *   - fr or unknown locale → master (never a foreign translation)
 *   - en → en translation ?? master
 *   - ar → ar translation ?? en ?? master
 */
export function resolveProductName(
  master: string,
  translations: ProductTranslationsMap,
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
 * Resolves short description with the same per-locale chain as the name.
 */
export function resolveProductShortDescription(
  master: string | null,
  translations: ProductTranslationsMap,
  locale: string
): string | null {
  if (locale === "en") {
    return translations.en?.shortDescription != null
      ? translations.en.shortDescription
      : master;
  }
  if (locale === "ar") {
    if (translations.ar?.shortDescription != null) {
      return translations.ar.shortDescription;
    }
    if (translations.en?.shortDescription != null) {
      return translations.en.shortDescription;
    }
    return master;
  }
  return master;
}

/**
 * Resolves the full description with the same per-locale chain as the name.
 */
export function resolveProductDescription(
  master: string | null,
  translations: ProductTranslationsMap,
  locale: string
): string | null {
  if (locale === "en") {
    return translations.en?.description != null
      ? translations.en.description
      : master;
  }
  if (locale === "ar") {
    if (translations.ar?.description != null) {
      return translations.ar.description;
    }
    if (translations.en?.description != null) {
      return translations.en.description;
    }
    return master;
  }
  return master;
}