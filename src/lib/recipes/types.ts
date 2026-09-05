import type { Database } from "@/types/database";

export type Recipe = Database["public"]["Tables"]["recipes"]["Row"];
export type RecipeInsert = Database["public"]["Tables"]["recipes"]["Insert"];
export type RecipeUpdate = Database["public"]["Tables"]["recipes"]["Update"];
export type RecipeItem = Database["public"]["Tables"]["recipe_items"]["Row"];
export type RecipeItemInsert =
  Database["public"]["Tables"]["recipe_items"]["Insert"];
export type RecipeTranslation =
  Database["public"]["Tables"]["recipe_translations"]["Row"];

export const RECIPE_STATUSES = [
  "draft",
  "active",
  "inactive",
  "archived",
] as const;
export type RecipeStatus = (typeof RECIPE_STATUSES)[number];

export function isRecipeStatus(value: unknown): value is RecipeStatus {
  return (
    typeof value === "string" &&
    (RECIPE_STATUSES as readonly string[]).includes(value)
  );
}

export const RECIPE_LOCALES = ["fr", "en", "ar"] as const;
export type RecipeLocale = (typeof RECIPE_LOCALES)[number];

export function isRecipeLocale(value: unknown): value is RecipeLocale {
  return (
    typeof value === "string" &&
    (RECIPE_LOCALES as readonly string[]).includes(value)
  );
}

/** Translations of a single recipe, indexed by locale. */
export interface RecipeLocaleTranslation {
  name: string;
  description: string | null;
  notes: string | null;
}
export type RecipeTranslationsMap = Partial<
  Record<RecipeLocale, RecipeLocaleTranslation>
>;

export type RecipeWithTranslations = Recipe & {
  translations: RecipeTranslationsMap;
};

/**
 * A recipe item augmented with the display references resolved for the UI:
 * the localized ingredient name/unit, the ingredient cost-per-base-unit and
 * the referenced sub-recipe name/status/version.
 */
export interface RecipeItemWithRefs extends RecipeItem {
  ingredientName: string | null;
  ingredientSku: string | null;
  ingredientBaseUnitId: string | null;
  costPerBaseUnit: number | null;
  subRecipeName: string | null;
  subRecipeStatus: RecipeStatus | null;
  subRecipeVersion: number | null;
  unitSymbol: string | null;
}

export type RecipeWithDetail = RecipeWithTranslations & {
  items: RecipeItemWithRefs[];
};

/** Version entries of a product (v1 … vN, with status + default markers). */
export interface RecipeVersionSummary {
  id: string;
  version: number;
  status: RecipeStatus;
  isDefault: boolean;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** Lightweight row returned by the sub-recipe selector / search endpoints. */
export interface RecipeSelectorEntry {
  id: string;
  name: string;
  version: number;
  status: RecipeStatus;
  isDefault: boolean;
  hasItems: boolean;
  itemCount: number;
  cost: number | null;
  productName: string | null;
}

/** Recipe list rows with the linked product identity for display. */
export interface RecipeListViewItem extends RecipeWithTranslations {
  productName: string;
  productSlug: string;
}

/** Presentation cost of a recipe (estimative, never persisted). */
export interface RecipeCostBreakdown {
  recipeId: string;
  /** Sum of ingredient/sub-recipe contributions in TND (null when absent). */
  rawCost: number | null;
  missingData: boolean;
  items: RecipeCostBreakdownItem[];
}

export interface RecipeCostBreakdownItem {
  itemId: string;
  label: string;
  quantity: number;
  unitSymbol: string | null;
  contribution: number | null;
}