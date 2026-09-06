import type {
  DiningArea,
  DiningAreaLocale,
  DiningAreaWithTranslations,
} from "./types";

/**
 * Slugify a dining-area / table label into a stable unique slug.
 * Latin accents are normalized before non-alphanumerics collapse to single
 * dashes; non-Latin scripts (Arabic) fall back to a readable marker.
 */
export function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (base || "element").slice(0, 80);
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidDiningSlug(value: string): boolean {
  return value.length > 0 && value.length <= 80 && SLUG_REGEX.test(value);
}

function normalizeDiningLocale(
  locale: DiningAreaLocale | string | null | undefined
): DiningAreaLocale | null {
  return locale === "fr" || locale === "en" || locale === "ar" ? locale : null;
}

/** Resolve the display name of an area for the active locale. */
export function resolveDiningAreaName(
  area: DiningArea | DiningAreaWithTranslations,
  locale: DiningAreaLocale | string
): string {
  if ("translations" in area) {
    const key = normalizeDiningLocale(locale);
    const localized = key ? area.translations[key]?.name : undefined;
    if (localized && localized.trim().length > 0) return localized.trim();
  }
  return area.name;
}

/** Resolve the display description of an area for the active locale. */
export function resolveDiningAreaDescription(
  area: DiningAreaWithTranslations,
  locale: DiningAreaLocale | string
): string | null {
  const key = normalizeDiningLocale(locale);
  const localized = key ? area.translations[key]?.description : undefined;
  if (localized && localized.trim().length > 0) return localized.trim();
  return area.description;
}