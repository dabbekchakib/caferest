import type { Database } from "@/types/database";

export type Ingredient =
  Database["public"]["Tables"]["ingredients"]["Row"];
export type IngredientInsert =
  Database["public"]["Tables"]["ingredients"]["Insert"];
export type IngredientUpdate =
  Database["public"]["Tables"]["ingredients"]["Update"];
export type IngredientTranslation = Database["public"]["Tables"]["ingredient_translations"]["Row"];

export const INGREDIENT_TYPES = [
  "raw_material",
  "semi_finished",
  "packaged",
  "consumable",
  "other",
] as const;
export type IngredientType = (typeof INGREDIENT_TYPES)[number];

export const INGREDIENT_LOCALES = ["fr", "en", "ar"] as const;
export type IngredientLocale = (typeof INGREDIENT_LOCALES)[number];

export function isIngredientLocale(value: unknown): value is IngredientLocale {
  return (
    typeof value === "string" &&
    (INGREDIENT_LOCALES as readonly string[]).includes(value)
  );
}

/** Translations of a single ingredient, indexed by locale. */
export type IngredientTranslationsMap = Partial<
  Record<IngredientLocale, { name: string; description: string | null }>
>;

export type IngredientWithTranslations = Ingredient & {
  translations: IngredientTranslationsMap;
};

/** Lightweight row returned by the selector/search endpoints. */
export interface IngredientSelectorEntry {
  id: string;
  name: string;
  sku: string | null;
  ingredientType: IngredientType;
  baseUnitId: string | null;
  purchaseUnitId: string | null;
  baseUnitSymbol: string | null;
  purchaseUnitSymbol: string | null;
  purchaseQuantity: number;
  purchaseCost: number;
  costPerBaseUnit: number | null;
  categoryId: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  isActive: boolean;
  isStockTracked: boolean;
  wastePercentage: number;
}