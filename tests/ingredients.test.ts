import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, uniqueSlug, isValidSlug } from "../src/lib/ingredients/slug";
import {
  groupIngredientTranslations,
  resolveIngredientName,
  resolveIngredientDescription,
} from "../src/lib/ingredients/translations";
import {
  formatCost,
  formatIngredientQuantity,
  formatWaste,
  parseDecimal,
  isNonNegativeNumber,
  isPositiveNumber,
} from "../src/lib/ingredients/formatters";
import {
  INGREDIENT_TYPES,
  INGREDIENT_LOCALES,
  isIngredientLocale,
  type IngredientTranslationsMap,
} from "../src/lib/ingredients/types";
import { calculateIngredientCostPerBaseUnit } from "../src/lib/ingredients/cost";
import {
  toAuthorizationError,
  authorizationErrorKey,
} from "../src/lib/authorization/errors";
import {
  createIngredientSchema,
  updateIngredientSchema,
  ingredientCostSchema,
  ingredientStatusSchema,
  ingredientReorderSchema,
} from "../src/validations/ingredients";
import type { UnitConversion } from "../src/lib/units/types";

const EST = "11111111-1111-4111-8111-111111111111";

function conv(
  id: string,
  from: string,
  to: string,
  factor: number
): UnitConversion {
  return {
    id,
    establishment_id: null,
    from_unit_id: from,
    to_unit_id: to,
    factor,
    offset_value: 0,
    is_system: true,
    is_active: true,
    created_at: "",
    updated_at: "",
  };
}

// kg -> g -> mg and L -> ml allow weight conversions of the demo ingredients.
const catalog: UnitConversion[] = [
  conv("1", "kg", "g", 1000),
  conv("2", "g", "mg", 1000),
  conv("3", "L", "ml", 1000),
  conv("4", "cl", "ml", 10),
];

const baseIngredient = {
  establishmentId: EST,
  name: "Café en grains",
  slug: "cafe-en-grains",
  ingredientType: "raw_material" as const,
  purchaseQuantity: 1,
  purchaseCost: 70,
};

test("uniqueSlug appends -2, -3 deterministically (ingredients)", () => {
  assert.equal(uniqueSlug("cafe", []), "cafe");
  assert.equal(uniqueSlug("cafe", ["the", "jus"]), "cafe");
  assert.equal(uniqueSlug("cafe", ["cafe"]), "cafe-2");
  assert.equal(uniqueSlug("cafe", ["cafe", "cafe-2"]), "cafe-3");
  assert.equal(uniqueSlug("cafe", ["CAFE", "Cafe-2"]), "cafe-3");
});

test("ingredient slug helpers share the category normalization", () => {
  assert.equal(slugify("Café en Grains"), "cafe-en-grains");
  assert.equal(slugify("Jus d'orange frais"), "jus-d-orange-frais");
  assert.equal(isValidSlug("cafe-en-grains"), true);
  assert.equal(isValidSlug("Cafe En Grains"), false);
  assert.equal(isValidSlug("cafe--grains"), false);
});

test("groupIngredientTranslations buckets rows by ingredient then locale", () => {
  const rows = [
    { ingredient_id: "i1", locale: "en", name: "Coffee beans", description: "d" },
    { ingredient_id: "i1", locale: "ar", name: "حبوب", description: null },
    { ingredient_id: "i2", locale: "en", name: "Milk", description: null },
  ];
  const grouped = groupIngredientTranslations(rows as never);
  assert.equal(grouped.i1?.en?.name, "Coffee beans");
  assert.equal(grouped.i1?.en?.description, "d");
  assert.equal(grouped.i1?.ar?.name, "حبوب");
  assert.equal(grouped.i2?.en?.name, "Milk");
  assert.equal(grouped.i2?.fr, undefined);
  assert.equal(grouped.missing, undefined);
});

test("resolveIngredientName falls back ar -> en -> fr (master)", () => {
  const translations: IngredientTranslationsMap = {
    en: { name: "Coffee beans", description: null },
    ar: { name: "حبوب القهوة", description: null },
  };
  assert.equal(
    resolveIngredientName("Café en grains", translations, "ar"),
    "حبوب القهوة"
  );
  assert.equal(
    resolveIngredientName("Café en grains", translations, "en"),
    "Coffee beans"
  );
  // FR is the master: it never yields to English.
  assert.equal(
    resolveIngredientName("Café en grains", translations, "fr"),
    "Café en grains"
  );
  assert.equal(
    resolveIngredientName("Café en grains", translations, "unknown"),
    "Café en grains"
  );

  // Without Arabic, the chain falls back to English, then the master.
  const enOnly: IngredientTranslationsMap = {
    en: { name: "Milk", description: null },
  };
  assert.equal(resolveIngredientName("Lait", enOnly, "ar"), "Milk");
  assert.equal(resolveIngredientName("Lait", {}, "ar"), "Lait");
  assert.equal(resolveIngredientName("Lait", {}, "en"), "Lait");
});

test("resolveIngredientDescription follows the same chain", () => {
  const full: IngredientTranslationsMap = {
    en: { name: "Milk", description: "Fresh cow milk." },
  };
  assert.equal(
    resolveIngredientDescription("Lait frais", full, "en"),
    "Fresh cow milk."
  );
  assert.equal(resolveIngredientDescription("Lait frais", {}, "ar"), "Lait frais");
  assert.equal(resolveIngredientDescription(null, {}, "ar"), null);
});

test("ingredient type and locale constants are stable", () => {
  assert.deepEqual(INGREDIENT_TYPES, [
    "raw_material",
    "semi_finished",
    "packaged",
    "consumable",
    "other",
  ]);
  assert.deepEqual(INGREDIENT_LOCALES, ["fr", "en", "ar"]);
  assert.equal(isIngredientLocale("ar"), true);
  assert.equal(isIngredientLocale("de"), false);
});

test("formatCost and parseDecimal round trip values", () => {
  assert.equal(formatCost(2500.5, "en"), "2,500.5");
  assert.equal(formatCost(0, "en"), "0");
  assert.equal(formatCost(1.23456, "en"), "1.235");
  const fr = formatCost(2500.5, "fr").replace(/[\u202F\u00A0 ]/g, " ");
  assert.equal(fr, "2 500,5");
  assert.equal(formatIngredientQuantity(1.23456, "en"), "1.235");
  assert.equal(formatWaste(12.345, "en"), "12");
  assert.equal(parseDecimal(""), null);
  assert.equal(parseDecimal("3,75"), 3.75);
  assert.equal(parseDecimal("3."), 3);
  assert.equal(parseDecimal("abc"), null);
  assert.equal(isNonNegativeNumber(0), true);
  assert.equal(isNonNegativeNumber(-1), false);
  assert.equal(isPositiveNumber(1), true);
  assert.equal(isPositiveNumber(0), false);
});

test("cost per base unit: 70 TND for 1 kg of coffee -> 0.070 TND/g", () => {
  const cost = calculateIngredientCostPerBaseUnit({
    purchaseCost: 70,
    purchaseQuantity: 1,
    purchaseUnitId: "kg",
    baseUnitId: "g",
    conversions: catalog,
  });
  assert.equal(cost, 0.07);
  assert.equal(JSON.parse(JSON.stringify(cost)), 0.07);
});

test("cost per base unit: same unit case divides by quantity only", () => {
  const cost = calculateIngredientCostPerBaseUnit({
    purchaseCost: 70,
    purchaseQuantity: 2,
    purchaseUnitId: "kg",
    baseUnitId: "kg",
    conversions: catalog,
  });
  assert.equal(cost, 35);
});

test("cost per base unit returns null when it cannot normalize", () => {
  assert.equal(
    calculateIngredientCostPerBaseUnit({
      purchaseCost: 70,
      purchaseQuantity: 1,
      purchaseUnitId: "kg",
      baseUnitId: null,
      conversions: catalog,
    }),
    null
  );
  assert.equal(
    calculateIngredientCostPerBaseUnit({
      purchaseCost: 70,
      purchaseQuantity: 1,
      purchaseUnitId: "",
      baseUnitId: "g",
      conversions: catalog,
    }),
    null
  );
  // Incompatible types: mass vs volume.
  assert.equal(
    calculateIngredientCostPerBaseUnit({
      purchaseCost: 70,
      purchaseQuantity: 1,
      purchaseUnitId: "kg",
      baseUnitId: "ml",
      conversions: catalog,
    }),
    null
  );
  assert.equal(
    calculateIngredientCostPerBaseUnit({
      purchaseCost: 70,
      purchaseQuantity: 0,
      purchaseUnitId: "kg",
      baseUnitId: "g",
      conversions: catalog,
    }),
    null
  );
});

test("createIngredientSchema accepts a valid ingredient", () => {
  const result = createIngredientSchema.safeParse(baseIngredient);
  assert.equal(result.success, true);
  assert.equal(result.data.purchaseQuantity, 1);
  assert.equal(result.data.purchaseCost, 70);
  assert.equal(result.data.wastePercentage, 0);
});

test("createIngredientSchema rejects bad type, slug, costs and UUIDs", () => {
  assert.equal(
    createIngredientSchema.safeParse({
      ...baseIngredient,
      ingredientType: "raw",
    }).success,
    false
  );
  assert.equal(
    createIngredientSchema.safeParse({
      ...baseIngredient,
      slug: "Cafe En Grains",
    }).success,
    false
  );
  assert.equal(
    createIngredientSchema.safeParse({
      ...baseIngredient,
      purchaseCost: -1,
    }).success,
    false
  );
  assert.equal(
    createIngredientSchema.safeParse({
      ...baseIngredient,
      purchaseQuantity: 0,
    }).success,
    false
  );
  assert.equal(
    createIngredientSchema.safeParse({
      ...baseIngredient,
      wastePercentage: 101,
    }).success,
    false
  );
  assert.equal(
    createIngredientSchema.safeParse({
      ...baseIngredient,
      categoryId: "not-a-uuid",
    }).success,
    false
  );
  assert.equal(
    createIngredientSchema.safeParse({ ...baseIngredient, sku: "x".repeat(81) })
      .success,
    false
  );
});

test("createIngredientSchema coerces numeric strings and accepts translations", () => {
  const parsed = createIngredientSchema.safeParse({
    ...baseIngredient,
    purchaseCost: "70.5",
    translations: {
      en: { name: "Coffee beans", description: "Roasted" },
      ar: { name: "حبوب القهوة" },
    },
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.purchaseCost, 70.5);
  assert.equal(parsed.data.translations?.en?.name, "Coffee beans");
});

test("updateIngredientSchema requires ingredientId and makes the core optional", () => {
  const ok = updateIngredientSchema.safeParse({
    ...baseIngredient,
    ingredientId: EST,
  });
  assert.equal(ok.success, true);
  assert.equal(
    updateIngredientSchema.safeParse({ ...baseIngredient, ingredientId: "bad" })
      .success,
    false
  );
  assert.equal(
    updateIngredientSchema.safeParse({ ...baseIngredient, purchaseCost: 5 })
      .success,
    false,
    "ingredientId is mandatory"
  );
});

test("ingredientCostSchema rejects a negative cost and missing ids", () => {
  const base = { establishmentId: EST, ingredientId: EST };
  assert.equal(
    ingredientCostSchema.safeParse({ ...base, purchaseCost: 12 }).success,
    true
  );
  assert.equal(
    ingredientCostSchema.safeParse({ ...base, purchaseCost: -1 }).success,
    false
  );
  assert.equal(
    ingredientCostSchema.safeParse({ purchaseCost: 12 }).success,
    false
  );
});

test("ingredientStatusSchema validates field and value", () => {
  const base = { establishmentId: EST, ingredientId: EST, value: true };
  assert.equal(
    ingredientStatusSchema.safeParse({ ...base, field: "is_active" }).success,
    true
  );
  assert.equal(
    ingredientStatusSchema.safeParse({ ...base, field: "is_stock_tracked" })
      .success,
    true
  );
  assert.equal(
    ingredientStatusSchema.safeParse({ ...base, field: "name" }).success,
    false
  );
  assert.equal(
    ingredientStatusSchema.safeParse({ ...base, field: "is_active", value: "yes" })
      .success,
    false
  );
});

test("ingredientReorderSchema requires non-empty orderedIds", () => {
  assert.equal(
    ingredientReorderSchema
      .safeParse({ establishmentId: EST, categoryId: null, orderedIds: [EST] })
      .success,
    true
  );
  assert.equal(
    ingredientReorderSchema.safeParse({
      establishmentId: EST,
      categoryId: null,
      orderedIds: [],
    }).success,
    false
  );
});

test("ingredient DB constraints map to stable domain codes", () => {
  const sku = toAuthorizationError({ message: "uq_ingredients_establishment_sku" });
  assert.equal(sku.code, "DUPLICATE_SKU");
  assert.equal(
    toAuthorizationError({ message: "ingredients_establishment_sku_key" }).code,
    "DUPLICATE_SKU"
  );
  const barcode = toAuthorizationError({
    message: "uq_ingredients_establishment_barcode",
  });
  assert.equal(barcode.code, "DUPLICATE_BARCODE");
  const slug = toAuthorizationError({
    message: "uq_ingredients_establishment_slug",
  });
  assert.equal(slug.code, "INGREDIENT_SLUG_EXISTS");
  const protectedRow = toAuthorizationError({
    message: "system_ingredient_protected",
  });
  assert.equal(protectedRow.code, "SYSTEM_INGREDIENT_PROTECTED");
  assert.equal(
    authorizationErrorKey("INGREDIENT_SLUG_EXISTS"),
    "authorization.errors.ingredientSlugExists"
  );
  assert.equal(
    authorizationErrorKey("SYSTEM_INGREDIENT_PROTECTED"),
    "authorization.errors.systemIngredient"
  );
  assert.equal(
    authorizationErrorKey("INGREDIENT_IN_USE"),
    "authorization.errors.ingredientInUse"
  );
});