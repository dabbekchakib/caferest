/**
 * Slugify a category name for its stable unique slug.
 * Latin accents are normalized (é -> e, ç -> c) before non-alphanumerics are
 * collapsed to single dashes. Non-Latin scripts (Arabic) fall back to a
 * readable, unique marker — the DB enforces per-establishment uniqueness with
 * DUPLICATE_SLUG surfaced to the form.
 */
export function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return (base || "categorie").slice(0, 80);
}

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(value: string): boolean {
  return value.length > 0 && value.length <= 80 && SLUG_REGEX.test(value);
}