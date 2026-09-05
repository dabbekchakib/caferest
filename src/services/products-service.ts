import { createClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  toAuthorizationError,
} from "@/lib/authorization/errors";
import type { Product } from "@/lib/products/types";
import {
  groupTranslations,
  resolveProductName,
  resolveProductShortDescription,
  resolveProductDescription,
} from "@/lib/products/translations";
import { slugify, uniqueSlug } from "@/lib/products/slug";
import type {
  ProductWithTranslations,
  ProductTranslationsMap,
  ProductSelectorEntry,
  ProductType,
} from "@/lib/products/types";

const PRODUCT_IMAGE_BUCKET = "product-images";
const PRODUCT_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const PRODUCT_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Master/fallback text fields always written to `products` (locale = fr). */
export interface ProductContentFields {
  name: string;
  shortDescription?: string | null;
  description?: string | null;
}

export interface ProductCreateInput extends ProductContentFields {
  slug?: string | null;
  sku?: string | null;
  barcode?: string | null;
  productType: ProductType;
  categoryId?: string | null;
  unitId?: string | null;
  taxId?: string | null;
  price?: number;
  cost?: number;
  sortOrder?: number;
  isActive?: boolean;
  isAvailable?: boolean;
  isFeatured?: boolean;
  isPosEnabled?: boolean;
  isStockTracked?: boolean;
  translations?: ProductTranslationInput[];
  imageUrl?: string | null;
}

export interface ProductUpdateInput {
  name?: string;
  shortDescription?: string | null;
  description?: string | null;
  slug?: string | null;
  sku?: string | null;
  barcode?: string | null;
  categoryId?: string | null;
  unitId?: string | null;
  taxId?: string | null;
  price?: number;
  cost?: number;
  isActive?: boolean;
  isAvailable?: boolean;
  isFeatured?: boolean;
  isPosEnabled?: boolean;
  isStockTracked?: boolean;
  translations?: ProductTranslationInput[];
  imageUrl?: string | null;
}

export interface ProductTranslationInput {
  locale: "en" | "ar";
  name?: string;
  shortDescription?: string | null;
  description?: string | null;
}

export interface ProductListOptions {
  activeOnly?: boolean;
  availableOnly?: boolean;
  posOnly?: boolean;
  featuredOnly?: boolean;
  categoryId?: string | null;
  types?: ProductType[];
  query?: string;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Active taxes usable by products in an establishment (id/name/rate). */
export interface TaxReference {
  id: string;
  name: string;
  rate: number;
}

export async function listTaxes(
  establishmentId: string
): Promise<TaxReference[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("taxes")
    .select("id, name, rate")
    .eq("establishment_id", establishmentId)
    .eq("is_active", true)
    .order("rate", { ascending: true });
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return data ?? [];
}

/** Single tax lookup regardless of active state (edit form keeps current row). */
export async function getTaxReference(
  establishmentId: string,
  taxId: string
): Promise<TaxReference | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("taxes")
    .select("id, name, rate")
    .eq("establishment_id", establishmentId)
    .eq("id", taxId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return data ?? null;
}

/** All products of an establishment, enriched with their translations. */
export async function listProducts(
  establishmentId: string,
  options: ProductListOptions = {}
): Promise<ProductWithTranslations[]> {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("*")
    .eq("establishment_id", establishmentId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (options.activeOnly) query = query.eq("is_active", true);
  if (options.availableOnly) query = query.eq("is_available", true);
  if (options.posOnly) query = query.eq("is_pos_enabled", true);
  if (options.featuredOnly) query = query.eq("is_featured", true);
  if (options.categoryId !== undefined) {
    query = options.categoryId
      ? query.eq("category_id", options.categoryId)
      : query.is("category_id", null);
  }
  if (options.types?.length) {
    query = query.in("product_type", options.types);
  }
  if (options.query) {
    const trimmed = options.query.trim().toLowerCase();
    if (trimmed) {
      const { data: matching } = await supabase
        .from("products")
        .select("id")
        .eq("establishment_id", establishmentId)
        .ilike("name", `%${trimmed}%`);
      const matchedIds = (matching ?? []).map((row) => row.id);
      query = query.in("id", matchedIds);
    }
  }

  const { data, error } = await query.limit(1000);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return enrichWithTranslations(data ?? []);
}

export async function getProduct(
  establishmentId: string,
  productId: string
): Promise<ProductWithTranslations | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("id", productId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) return null;
  const enriched = await enrichWithTranslations([data]);
  return enriched[0] ?? null;
}

export async function getProductsByCategory(
  establishmentId: string,
  categoryId: string
): Promise<ProductWithTranslations[]> {
  return listProducts(establishmentId, { categoryId });
}

/** Products visible on the POS: active, available, POS-enabled. */
export async function getPosProducts(
  establishmentId: string
): Promise<ProductWithTranslations[]> {
  return listProducts(establishmentId, {
    activeOnly: true,
    availableOnly: true,
    posOnly: true,
  });
}

/**
 * Catalog search over master name / SKU / barcode and localized names.
 * Returns lightweight rows for selectors; cap is applied after matching.
 */
export async function searchProducts(
  establishmentId: string,
  query: string,
  options: { locale?: string; limit?: number } = {}
): Promise<ProductSelectorEntry[]> {
  const limit = options.limit ?? 20;
  const trimmed = query.trim();
  if (!trimmed) return [];

  const supabase = await createClient();
  const like = `%${trimmed}%`;
  const [byName, bySku, byBarcode, byTranslation] = await Promise.all([
    supabase
      .from("products")
      .select("id")
      .eq("establishment_id", establishmentId)
      .ilike("name", like),
    supabase
      .from("products")
      .select("id")
      .eq("establishment_id", establishmentId)
      .ilike("sku", like),
    supabase
      .from("products")
      .select("id")
      .eq("establishment_id", establishmentId)
      .ilike("barcode", like),
    supabase
      .from("product_translations")
      .select("product_id")
      .ilike("name", like),
  ]);

  const ids = new Set<string>();
  for (const rows of [byName.data, bySku.data, byBarcode.data]) {
    for (const row of rows ?? []) ids.add(row.id);
  }
  for (const row of byTranslation.data ?? []) ids.add(row.product_id);

  if (ids.size === 0) return [];
  const ranked = [...ids].slice(0, limit * 2);

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .eq("establishment_id", establishmentId)
    .in("id", ranked)
    .limit(limit * 2);
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const rows = products ?? [];
  const translations = await fetchTranslationsFor(
    rows.map((row) => row.id)
  );
  const categoryNames = await categoryNameMap(establishmentId);
  const unitSymbols = await unitSymbolMap(establishmentId);

  return rows.slice(0, limit).map((product) => {
    const locale = options.locale && isLocale(options.locale) ? options.locale : "fr";
    const tr = translations[product.id] ?? {};
    return {
      id: product.id,
      name: resolveProductName(product.name, tr, locale),
      sku: product.sku,
      price: product.price,
      unitSymbol: product.unit_id ? unitSymbols.get(product.unit_id) ?? null : null,
      categoryName: product.category_id
        ? categoryNames.get(product.category_id) ?? null
        : null,
      imageUrl: product.image_url,
      isAvailable: product.is_active && product.is_available,
    };
  });
}

export { resolveProductName, resolveProductShortDescription, resolveProductDescription };

// ---------------------------------------------------------------------------
// Counters (future dashboard)
// ---------------------------------------------------------------------------

async function countProductsWhere(
  establishmentId: string,
  where: Array<{ key: string; value: unknown }>
): Promise<number> {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("establishment_id", establishmentId);
  for (const { key, value } of where) {
    query = query.eq(key, value);
  }
  const { count, error } = await query;
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return count ?? 0;
}

export async function countProducts(establishmentId: string): Promise<number> {
  return countProductsWhere(establishmentId, []);
}

export async function countActiveProducts(
  establishmentId: string
): Promise<number> {
  return countProductsWhere(establishmentId, [{ key: "is_active", value: true }]);
}

export async function countAvailableProducts(
  establishmentId: string
): Promise<number> {
  return countProductsWhere(establishmentId, [{ key: "is_available", value: true }]);
}

export async function countPosProducts(
  establishmentId: string
): Promise<number> {
  return countProductsWhere(establishmentId, [
    { key: "is_active", value: true },
    { key: "is_available", value: true },
    { key: "is_pos_enabled", value: true },
  ]);
}

export async function countProductsByCategory(
  establishmentId: string,
  categoryId: string
): Promise<number> {
  return countProductsWhere(establishmentId, [{ key: "category_id", value: categoryId }]);
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createProduct(
  establishmentId: string,
  input: ProductCreateInput
): Promise<Product> {
  const supabase = await createClient();
  const name = input.name.trim();
  const requestedSlug = input.slug && input.slug.trim() ? slugify(input.slug) : slugify(name);
  if (!requestedSlug) throw new AuthorizationError("GENERIC", "invalid_slug");

  const taken = await existingSlugs(establishmentId);
  const slug = uniqueSlug(requestedSlug, taken);

  await assertSkuAvailable(establishmentId, input.sku, undefined);
  await assertBarcodeAvailable(establishmentId, input.barcode, undefined);
  await assertReferences(establishmentId, input);

  const { data, error } = await supabase
    .from("products")
    .insert({
      establishment_id: establishmentId,
      category_id: input.categoryId ?? null,
      name,
      slug,
      short_description: input.shortDescription ?? null,
      description: input.description ?? null,
      sku: input.sku?.trim() ? input.sku.trim() : null,
      barcode: input.barcode?.trim() ? input.barcode.trim() : null,
      product_type: input.productType,
      unit_id: input.unitId ?? null,
      tax_id: input.taxId ?? null,
      price: input.price ?? 0,
      cost: input.cost ?? 0,
      image_url: input.imageUrl ?? null,
      sort_order: input.sortOrder ?? 10,
      is_active: input.isActive ?? true,
      is_available: input.isAvailable ?? true,
      is_featured: input.isFeatured ?? false,
      is_pos_enabled: input.isPosEnabled ?? true,
      is_stock_tracked: input.isStockTracked ?? false,
      is_system: false,
    })
    .select()
    .single();
  if (error) throw toProductError(error);

  await upsertTranslations(supabase, data.id, input.translations ?? []);
  return data;
}

export async function updateProduct(
  establishmentId: string,
  productId: string,
  input: ProductUpdateInput
): Promise<ProductWithTranslations> {
  const supabase = await createClient();
  const existing = await getProductRow(establishmentId, productId);
  if (existing.is_system) throw new AuthorizationError("SYSTEM_PRODUCT_PROTECTED");

  let slug = existing.slug;
  if (input.slug && input.slug.trim() && slugify(input.slug) !== existing.slug) {
    slug = slugify(input.slug);
    const taken = await existingSlugs(establishmentId, existing.id);
    if (taken.has(slug)) throw new AuthorizationError("PRODUCT_SLUG_EXISTS", "product_slug_exists");
  }

  await assertSkuAvailable(establishmentId, input.sku, existing.id);
  await assertBarcodeAvailable(establishmentId, input.barcode, existing.id);
  const refsChanged =
    input.categoryId !== undefined ||
    input.unitId !== undefined ||
    input.taxId !== undefined;
  if (refsChanged) {
    await assertReferences(establishmentId, {
      categoryId: input.categoryId === undefined ? existing.category_id : input.categoryId,
      unitId: input.unitId === undefined ? existing.unit_id : input.unitId,
      taxId: input.taxId === undefined ? existing.tax_id : input.taxId,
    });
  }

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.shortDescription !== undefined) patch.short_description = input.shortDescription;
  if (input.description !== undefined) patch.description = input.description;
  patch.slug = slug;
  if (input.sku !== undefined) patch.sku = input.sku?.trim() ? input.sku.trim() : null;
  if (input.barcode !== undefined) patch.barcode = input.barcode?.trim() ? input.barcode.trim() : null;
  if (input.categoryId !== undefined) patch.category_id = input.categoryId ?? null;
  if (input.unitId !== undefined) patch.unit_id = input.unitId ?? null;
  if (input.taxId !== undefined) patch.tax_id = input.taxId ?? null;
  if (input.price !== undefined) patch.price = input.price;
  if (input.cost !== undefined) patch.cost = input.cost;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if (input.isAvailable !== undefined) patch.is_available = input.isAvailable;
  if (input.isFeatured !== undefined) patch.is_featured = input.isFeatured;
  if (input.isPosEnabled !== undefined) patch.is_pos_enabled = input.isPosEnabled;
  if (input.isStockTracked !== undefined) patch.is_stock_tracked = input.isStockTracked;
  if (input.imageUrl !== undefined) patch.image_url = input.imageUrl;

  const { error } = await supabase
    .from("products")
    .update(patch)
    .eq("establishment_id", establishmentId)
    .eq("id", productId)
    .eq("is_system", false)
    .select()
    .single();
  if (error) throw toProductError(error);

  if (input.translations) {
    await upsertTranslations(supabase, productId, input.translations);
  }

  const enriched = await getProduct(establishmentId, productId);
  return enriched ?? (() => { throw new AuthorizationError("RESOURCE_NOT_FOUND", "product_not_found"); })();
}

export async function deleteProduct(
  establishmentId: string,
  productId: string
): Promise<void> {
  const supabase = await createClient();
  const existing = await getProductRow(establishmentId, productId);
  if (existing.is_system) throw new AuthorizationError("SYSTEM_PRODUCT_PROTECTED");

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("establishment_id", establishmentId)
    .eq("id", productId)
    .eq("is_system", false);
  if (error) throw toProductError(error);

  if (existing.image_url) {
    try {
      await removeProductImage(existing.image_url);
    } catch {
      // best-effort cleanup, never blocks the delete
    }
  }
}

export async function setProductStatus(
  establishmentId: string,
  productId: string,
  field: "is_active" | "is_available" | "is_pos_enabled" | "is_featured",
  value: boolean
): Promise<void> {
  const supabase = await createClient();
  const existing = await getProductRow(establishmentId, productId);
  if (existing.is_system) throw new AuthorizationError("SYSTEM_PRODUCT_PROTECTED");

  const { error } = await supabase
    .from("products")
    .update({ [field]: value })
    .eq("establishment_id", establishmentId)
    .eq("id", productId)
    .eq("is_system", false);
  if (error) throw toProductError(error);
}

export async function updateProductPrice(
  establishmentId: string,
  productId: string,
  price: number
): Promise<void> {
  const supabase = await createClient();
  const existing = await getProductRow(establishmentId, productId);
  if (existing.is_system) throw new AuthorizationError("SYSTEM_PRODUCT_PROTECTED");

  const { error } = await supabase
    .from("products")
    .update({ price })
    .eq("establishment_id", establishmentId)
    .eq("id", productId)
    .eq("is_system", false);
  if (error) throw toProductError(error);
}

/**
 * Persists a full sibling ordering: every product must belong to
 * `categoryId` (or be uncategorized when categoryId is null).
 */
export async function reorderProducts(
  allProducts: Product[],
  categoryId: string | null,
  orderedIds: string[]
): Promise<void> {
  const siblings = allProducts.filter(
    (product) => (product.category_id ?? null) === categoryId
  );
  const siblingIds = new Set(siblings.map((product) => product.id));
  if (orderedIds.length !== siblingIds.size) {
    throw new AuthorizationError("GENERIC", "reorder_invalid_membership");
  }
  for (const id of orderedIds) {
    if (!siblingIds.has(id)) {
      throw new AuthorizationError("GENERIC", "reorder_invalid_membership");
    }
  }

  const supabase = await createClient();
  const writes = orderedIds.map(async (id, index) => {
    const product = siblings.find((p) => p.id === id);
    const nextSort = (index + 1) * 10;
    if (!product || product.sort_order === nextSort) return;
    const { error } = await supabase
      .from("products")
      .update({ sort_order: nextSort })
      .eq("id", id);
    if (error) throw toProductError(error);
  });
  await Promise.all(writes);
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

export async function uploadProductImage(
  establishmentId: string,
  productId: string,
  file: File
): Promise<string> {
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new AuthorizationError("GENERIC", "product_image_too_large");
  }
  if (!PRODUCT_IMAGE_MIMES.has(file.type)) {
    throw new AuthorizationError("GENERIC", "product_image_bad_type");
  }

  const safeName = String(file.name)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(-80);
  const path = `establishments/${establishmentId}/products/${productId}/${Date.now()}_${safeName}`;

  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new AuthorizationError("GENERIC", error.message);

  const { data } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function removeProductImage(imageUrl: string): Promise<void> {
  const path = extractStoredImagePath(imageUrl);
  if (!path) return;
  const supabase = await createClient();
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .remove([path]);
  if (error) throw new AuthorizationError("GENERIC", error.message);
}

export function extractStoredImagePath(imageUrl: string): string | null {
  try {
    const url = new URL(imageUrl);
    const segments = url.pathname.split("/").filter(Boolean);
    const bucketIndex = segments.findIndex((s) => s === "product-images");
    if (bucketIndex === -1) return null;
    return segments.slice(bucketIndex + 1).join("/");
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

async function getProductRow(
  establishmentId: string,
  productId: string
): Promise<Product> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("establishment_id", establishmentId)
    .eq("id", productId)
    .maybeSingle();
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (!data) throw new AuthorizationError("RESOURCE_NOT_FOUND", "product_not_found");
  return data;
}

async function enrichWithTranslations(
  products: Product[]
): Promise<ProductWithTranslations[]> {
  if (products.length === 0) return [];
  const translations = await fetchTranslationsFor(
    products.map((product) => product.id)
  );
  return products.map((product) => ({
    ...product,
    translations: translations[product.id] ?? ({} as ProductTranslationsMap),
  }));
}

async function fetchTranslationsFor(
  productIds: string[]
): Promise<Record<string, ProductTranslationsMap>> {
  if (productIds.length === 0) return {};
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_translations")
    .select("*")
    .in("product_id", productIds);
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return groupTranslations(data ?? []);
}

async function existingSlugs(
  establishmentId: string,
  excludingId?: string
): Promise<Set<string>> {
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("slug")
    .eq("establishment_id", establishmentId);
  if (excludingId) query = query.neq("id", excludingId);
  const { data, error } = await query;
  if (error) throw new AuthorizationError("GENERIC", error.message);
  return new Set((data ?? []).map((row) => row.slug));
}

async function assertSkuAvailable(
  establishmentId: string,
  sku: string | null | undefined,
  excludingId?: string
): Promise<void> {
  const value = sku?.trim();
  if (!value) return;
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id")
    .eq("establishment_id", establishmentId)
    .eq("sku", value);
  if (excludingId) query = query.neq("id", excludingId);
  const { data, error } = await query;
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (data && data.length > 0) {
    throw new AuthorizationError("DUPLICATE_SKU", "duplicate_sku");
  }
}

async function assertBarcodeAvailable(
  establishmentId: string,
  barcode: string | null | undefined,
  excludingId?: string
): Promise<void> {
  const value = barcode?.trim();
  if (!value) return;
  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select("id")
    .eq("establishment_id", establishmentId)
    .eq("barcode", value);
  if (excludingId) query = query.neq("id", excludingId);
  const { data, error } = await query;
  if (error) throw new AuthorizationError("GENERIC", error.message);
  if (data && data.length > 0) {
    throw new AuthorizationError("DUPLICATE_BARCODE", "duplicate_barcode");
  }
}

interface PartialRefs {
  categoryId?: string | null;
  unitId?: string | null;
  taxId?: string | null;
}

/** Forbids references to rows of another establishment (system units allowed). */
async function assertReferences(
  establishmentId: string,
  refs: PartialRefs
): Promise<void> {
  const supabase = await createClient();

  if (refs.categoryId) {
    const { data, error } = await supabase
      .from("categories")
      .select("establishment_id")
      .eq("id", refs.categoryId)
      .maybeSingle();
    if (error || !data || data.establishment_id !== establishmentId) {
      throw new AuthorizationError("RESOURCE_NOT_FOUND", "category_not_found");
    }
  }

  if (refs.unitId) {
    const { data, error } = await supabase
      .from("units")
      .select("establishment_id")
      .eq("id", refs.unitId)
      .maybeSingle();
    if (error || !data) {
      throw new AuthorizationError("RESOURCE_NOT_FOUND", "unit_not_found");
    }
    if (data.establishment_id !== establishmentId && data.establishment_id !== null) {
      throw new AuthorizationError("RESOURCE_NOT_FOUND", "unit_not_found");
    }
  }

  if (refs.taxId) {
    const { data, error } = await supabase
      .from("taxes")
      .select("establishment_id")
      .eq("id", refs.taxId)
      .maybeSingle();
    if (error || !data || data.establishment_id !== establishmentId) {
      throw new AuthorizationError("RESOURCE_NOT_FOUND", "tax_not_found");
    }
  }
}

async function upsertTranslations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productId: string,
  translations: ProductTranslationInput[]
): Promise<void> {
  for (const entry of translations) {
    const name = entry.name?.trim() ?? "";
    if (name === "") {
      await supabase
        .from("product_translations")
        .delete()
        .eq("product_id", productId)
        .eq("locale", entry.locale);
      continue;
    }
    const { error } = await supabase.from("product_translations").upsert(
      {
        product_id: productId,
        locale: entry.locale,
        name,
        short_description: entry.shortDescription ?? null,
        description: entry.description ?? null,
      },
      { onConflict: "product_id,locale" }
    );
    if (error) throw toProductError(error);
  }
}

function toProductError(error: { message: string }): AuthorizationError {
  // Maps DB constraint messages (e.g. `products_establishment_sku_key`,
  // `system_product_protected`) onto stable domain codes.
  return toAuthorizationError(error) as AuthorizationError;
}

function isLocale(value: string): boolean {
  return value === "fr" || value === "en" || value === "ar";
}

async function categoryNameMap(
  establishmentId: string
): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("establishment_id", establishmentId);
  if (error) return new Map();
  return new Map((data ?? []).map((row) => [row.id, row.name]));
}

async function unitSymbolMap(
  establishmentId: string
): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("units")
    .select("id, symbol")
    .or(`establishment_id.eq.${establishmentId},establishment_id.is.null`);
  if (error) return new Map();
  return new Map((data ?? []).map((row) => [row.id, row.symbol]));
}