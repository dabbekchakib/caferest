import type { Database } from "@/types/database";

export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type CategoryTranslation =
  Database["public"]["Tables"]["category_translations"]["Row"];

/** Locales supported by the translations table (seed + form). */
export const CATEGORY_LOCALES = ["fr", "en", "ar"] as const;
export type CategoryLocale = (typeof CATEGORY_LOCALES)[number];

export function isCategoryLocale(value: string): value is CategoryLocale {
  return (CATEGORY_LOCALES as readonly string[]).includes(value);
}

/** Translations for one category, indexed by locale (optional subsets). */
export type CategoryTranslationsMap = Partial<
  Record<CategoryLocale, { name: string; description: string | null }>
>;

/** Minimal shape the tree helpers operate on (testable without Supabase). */
export interface CategoryLike {
  id: string;
  parent_id: string | null;
  sort_order: number;
  name: string;
}

export interface CategoryNode<T extends CategoryLike = CategoryLike> {
  /** The category plus its resolved children. */
  node: T;
  children: CategoryNode<T>[];
}

export interface FlatCategoryEntry<T extends CategoryLike = CategoryLike> {
  node: T;
  depth: number;
  path: string;
}

/** Category row joined with its translations (read/display layer). */
export type CategoryWithTranslations = Category & {
  translations: CategoryTranslationsMap;
};