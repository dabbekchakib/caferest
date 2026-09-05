import type { Database } from "@/types/database";

export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductInsert = Database["public"]["Tables"]["products"]["Insert"];
export type ProductUpdate = Database["public"]["Tables"]["products"]["Update"];
export type ProductTranslation = Database["public"]["Tables"]["product_translations"]["Row"];

export const PRODUCT_TYPES = ["product", "composite", "service"] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_LOCALES = ["fr", "en", "ar"] as const;
export type ProductLocale = (typeof PRODUCT_LOCALES)[number];

export function isProductLocale(value: unknown): value is ProductLocale {
  return (
    typeof value === "string" &&
    (PRODUCT_LOCALES as readonly string[]).includes(value)
  );
}

/** Translations of a single product, indexed by locale. */
export type ProductTranslationsMap = Partial<
  Record<ProductLocale, { name: string; shortDescription: string | null; description: string | null }>
>;

export type ProductWithTranslations = Product & {
  translations: ProductTranslationsMap;
};

/** Lightweight row returned by the selector/search endpoints. */
export interface ProductSelectorEntry {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  unitSymbol: string | null;
  categoryName: string | null;
  imageUrl: string | null;
  isAvailable: boolean;
}