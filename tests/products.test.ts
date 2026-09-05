import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, uniqueSlug, isValidSlug } from "../src/lib/products/slug";
import {
  groupTranslations,
  resolveProductName,
  resolveProductShortDescription,
  resolveProductDescription,
} from "../src/lib/products/translations";
import {
  formatPrice,
  parseDecimal,
  isNonNegativeNumber,
} from "../src/lib/products/formatters";
import {
  PRODUCT_TYPES,
  PRODUCT_LOCALES,
  isProductLocale,
  type ProductTranslationsMap,
} from "../src/lib/products/types";
import {
  toAuthorizationError,
  authorizationErrorKey,
} from "../src/lib/authorization/errors";
import {
  createProductSchema,
  updateProductSchema,
  productPriceSchema,
  productStatusSchema,
  productReorderSchema,
} from "../src/validations/products";

const EST = "11111111-1111-4111-8111-111111111111";

const baseProduct = {
  establishmentId: EST,
  name: "Café au lait",
  slug: "cafe-au-lait",
  productType: "product",
  price: 2.5,
  cost: 0.8,
};

test("uniqueSlug appends -2, -3 deterministically", () => {
  assert.equal(uniqueSlug("cafe", []), "cafe");
  assert.equal(uniqueSlug("cafe", ["the", "jus"]), "cafe");
  assert.equal(uniqueSlug("cafe", ["cafe"]), "cafe-2");
  assert.equal(uniqueSlug("cafe", ["cafe", "cafe-2"]), "cafe-3");
  assert.equal(uniqueSlug("cafe", ["CAFE", "Cafe-2"]), "cafe-3");
});

test("products slug helpers share the category normalization", () => {
  assert.equal(slugify("Café au Lait"), "cafe-au-lait");
  assert.equal(slugify("Jus d'orange frais"), "jus-d-orange-frais");
  assert.equal(isValidSlug("cafe-au-lait"), true);
  assert.equal(isValidSlug("Cafe Au Lait"), false);
  assert.equal(isValidSlug("cafe--lait"), false);
});

test("groupTranslations buckets rows by product then locale", () => {
  const rows = [
    { product_id: "p1", locale: "en", name: "Coffee", short_description: "s", description: "d" },
    { product_id: "p1", locale: "ar", name: "قهوة", short_description: null, description: null },
    { product_id: "p2", locale: "en", name: "Tea", short_description: null, description: null },
  ];
  const grouped = groupTranslations(rows as never);
  assert.equal(grouped.p1?.en?.name, "Coffee");
  assert.equal(grouped.p1?.en?.shortDescription, "s");
  assert.equal(grouped.p1?.ar?.name, "قهوة");
  assert.equal(grouped.p2?.en?.name, "Tea");
  assert.equal(grouped.p2?.fr, undefined);
  assert.equal(grouped.missing, undefined);
});

test("resolveProductName falls back locale -> fr (master) -> en", () => {
  const translations: ProductTranslationsMap = {
    en: { name: "Mint tea", shortDescription: null, description: null },
    ar: { name: "شاي", shortDescription: null, description: null },
  };
  assert.equal(resolveProductName("Thé à la menthe", translations, "ar"), "شاي");
  assert.equal(resolveProductName("Thé à la menthe", translations, "en"), "Mint tea");
  // FR is the master locale: the French master never yields to English.
  assert.equal(resolveProductName("Thé à la menthe", translations, "fr"), "Thé à la menthe");
  assert.equal(resolveProductName("Thé à la menthe", translations, "unknown"), "Thé à la menthe");

  // A fr translation row is never written for products (products.name IS the
  // French name), so it is intentionally ignored by the per-locale chain.
  const frSet: ProductTranslationsMap = {
    fr: { name: "Thé", shortDescription: null, description: null },
  };
  assert.equal(resolveProductName("Master", frSet, "ar"), "Master");
  assert.equal(resolveProductName("Master", frSet, "fr"), "Master");
  assert.equal(resolveProductName("Master", {}, "ar"), "Master");
});

test("resolveProductShortDescription and description fall back like the name", () => {
  const full: ProductTranslationsMap = {
    en: {
      name: "Espresso",
      shortDescription: "Strong coffee",
      description: "A short strong coffee.",
    },
  };
  assert.equal(resolveProductShortDescription("Café serré", full, "en"), "Strong coffee");
  assert.equal(resolveProductShortDescription("Café serré", full, "fr"), "Café serré");
  assert.equal(resolveProductShortDescription(null, full, "ar"), "Strong coffee");
  assert.equal(resolveProductShortDescription(null, {}, "ar"), null);

  assert.equal(resolveProductDescription("Un café.", full, "en"), "A short strong coffee.");
  assert.equal(resolveProductDescription("Un café.", {}, "fr"), "Un café.");
  assert.equal(resolveProductDescription(null, {}, "ar"), null);
});

test("product type and locale constants are stable", () => {
  assert.deepEqual(PRODUCT_TYPES, ["product", "composite", "service"]);
  assert.deepEqual(PRODUCT_LOCALES, ["fr", "en", "ar"]);
  assert.equal(isProductLocale("ar"), true);
  assert.equal(isProductLocale("de"), false);
});

test("formatPrice and parseDecimal round trip values", () => {
  assert.equal(formatPrice(2500.5, "en"), "2,500.5");
  assert.equal(formatPrice(0, "en"), "0");
  assert.equal(formatPrice(1.23456, "en"), "1.235");
  // French grouping uses a narrow no-break space depending on the ICU build.
  const fr = formatPrice(2500.5, "fr").replace(/[\u202F\u00A0 ]/g, " ");
  assert.equal(fr, "2 500,5");
  assert.equal(parseDecimal(""), null);
  assert.equal(parseDecimal("3,75"), 3.75);
  assert.equal(parseDecimal("3."), 3);
  assert.equal(parseDecimal("abc"), null);
  assert.equal(isNonNegativeNumber(0), true);
  assert.equal(isNonNegativeNumber(-1), false);
  assert.equal(isNonNegativeNumber(Number.NaN), false);
});

test("createProductSchema accepts a valid product", () => {
  const result = createProductSchema.safeParse(baseProduct);
  assert.equal(result.success, true);
});

test("createProductSchema rejects negative prices and costs", () => {
  assert.equal(
    createProductSchema.safeParse({ ...baseProduct, price: -1 }).success,
    false
  );
  assert.equal(
    createProductSchema.safeParse({ ...baseProduct, cost: -0.01 }).success,
    false
  );
});

test("createProductSchema rejects invalid type, slug and bad UUIDs", () => {
  assert.equal(
    createProductSchema.safeParse({ ...baseProduct, productType: "combo" }).success,
    false
  );
  assert.equal(
    createProductSchema.safeParse({ ...baseProduct, slug: "Cafe Au Lait" }).success,
    false
  );
  assert.equal(
    createProductSchema.safeParse({ ...baseProduct, categoryId: "not-a-uuid" }).success,
    false
  );
  assert.equal(createProductSchema.safeParse({ ...baseProduct, sku: "x".repeat(81) }).success, false);
});

test("createProductSchema coerces numeric string prices and accepts translations", () => {
  const parsed = createProductSchema.safeParse({
    ...baseProduct,
    price: "2.5",
    translations: {
      en: { name: "Coffee with milk", shortDescription: "Short" },
      ar: { name: "قهوة بالحليب" },
    },
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.price, 2.5);
  assert.equal(parsed.data.translations?.en?.name, "Coffee with milk");
});

test("updateProductSchema requires a productId and makes name/slug optional", () => {
  const ok = updateProductSchema.safeParse({ ...baseProduct, productId: EST });
  assert.equal(ok.success, true);
  assert.equal(
    updateProductSchema.safeParse({ ...baseProduct, productId: "bad" }).success,
    false
  );
  assert.equal(
    updateProductSchema.safeParse({ ...baseProduct, price: 5 }).success,
    false,
    "productId is mandatory"
  );
});

test("productPriceSchema rejects missing productId and negative price", () => {
  assert.equal(
    productPriceSchema.safeParse({ establishmentId: EST, productId: EST, price: 12 }).success,
    true
  );
  assert.equal(productPriceSchema.safeParse({ productId: EST, price: 12 }).success, false);
  assert.equal(
    productPriceSchema.safeParse({ establishmentId: EST, productId: EST, price: -1 }).success,
    false
  );
});

test("productStatusSchema validates field and value", () => {
  const base = { establishmentId: EST, productId: EST, value: true };
  assert.equal(productStatusSchema.safeParse({ ...base, field: "is_active" }).success, true);
  assert.equal(productStatusSchema.safeParse({ ...base, field: "is_featured" }).success, true);
  assert.equal(productStatusSchema.safeParse({ ...base, field: "name" }).success, false);
  assert.equal(productStatusSchema.safeParse({ ...base, field: "is_active", value: "yes" }).success, false);
});

test("productReorderSchema requires non-empty orderedIds", () => {
  assert.equal(
    productReorderSchema
      .safeParse({ establishmentId: EST, categoryId: null, orderedIds: [EST] })
      .success,
    true
  );
  assert.equal(
    productReorderSchema.safeParse({ establishmentId: EST, categoryId: null, orderedIds: [] }).success,
    false
  );
});

test("product DB constraints map to stable domain codes", () => {
  const sku = toAuthorizationError({ message: "products_establishment_sku_key" });
  assert.equal(sku.code, "DUPLICATE_SKU");
  const barcode = toAuthorizationError({ message: "products_establishment_barcode_key" });
  assert.equal(barcode.code, "DUPLICATE_BARCODE");
  const slug = toAuthorizationError({ message: "products_establishment_slug_key" });
  assert.equal(slug.code, "PRODUCT_SLUG_EXISTS");
  const protectedRow = toAuthorizationError({ message: "system_product_protected" });
  assert.equal(protectedRow.code, "SYSTEM_PRODUCT_PROTECTED");
  assert.equal(
    authorizationErrorKey("DUPLICATE_SKU"),
    "authorization.errors.duplicateSku"
  );
  assert.equal(
    authorizationErrorKey("PRODUCT_SLUG_EXISTS"),
    "authorization.errors.productSlugExists"
  );
  assert.equal(
    authorizationErrorKey("SYSTEM_PRODUCT_PROTECTED"),
    "authorization.errors.systemProduct"
  );
  assert.equal(
    authorizationErrorKey("PRODUCT_IN_USE"),
    "authorization.errors.productInUse"
  );
});