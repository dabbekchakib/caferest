import { test } from "node:test";
import assert from "node:assert/strict";
import {
  groupRecipeTranslations,
  resolveRecipeName,
  resolveRecipeDescription,
  resolveRecipeNotes,
} from "../src/lib/recipes/translations";
import {
  subRecipeAdjacency,
  isSubRecipeReachable,
  wouldCreateSubRecipeCycle,
} from "../src/lib/recipes/graph";
import { normalizeRecipeItemQuantity, isRecipeItemUnitCompatible } from "../src/lib/recipes/normalizer";
import {
  calculateRecipeItemRawCost,
  calculateRecipeRawCost,
} from "../src/lib/recipes/costing";
import {
  parseRecipeDecimal,
  filterUnitsCompatibleWith,
} from "../src/lib/recipes/formatters";
import {
  RECIPE_STATUSES,
  RECIPE_LOCALES,
  isRecipeStatus,
  isRecipeLocale,
  type RecipeTranslationsMap,
} from "../src/lib/recipes/types";
import {
  RECIPE_MIN_ITEMS_FOR_ACTIVE,
  MAX_SUBRECIPE_DEPTH,
  RECIPE_STATUS_ORDER,
} from "../src/lib/recipes/constants";
import {
  recipeItemSchema,
  recipeItemsSchema,
  createRecipeSchema,
  updateRecipeSchema,
} from "../src/validations/recipes";
import {
  toAuthorizationError,
  authorizationErrorKey,
} from "../src/lib/authorization/errors";
import type { Unit, UnitConversion } from "../src/lib/units/types";

const EST = "11111111-1111-4111-8111-111111111111";
const RECIPE_ID = "22222222-2222-4222-8222-222222222222";
const PRODUCT_ID = "33333333-3333-4333-8333-333333333333";

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

// kg -> g and L -> ml allow weight/volume conversions of the demo ingredients.
const catalog: UnitConversion[] = [
  conv("1", "kg", "g", 1000),
  conv("2", "g", "mg", 1000),
  conv("3", "L", "ml", 1000),
  conv("4", "cl", "ml", 10),
];

test("recipe status and locale constants are stable", () => {
  assert.deepEqual(RECIPE_STATUSES, ["draft", "active", "inactive", "archived"]);
  assert.deepEqual(RECIPE_LOCALES, ["fr", "en", "ar"]);
  assert.equal(RECIPE_MIN_ITEMS_FOR_ACTIVE, 1);
  assert.equal(MAX_SUBRECIPE_DEPTH, 20);
  assert.deepEqual(RECIPE_STATUS_ORDER, ["draft", "active", "inactive", "archived"]);
  assert.equal(isRecipeStatus("active"), true);
  assert.equal(isRecipeStatus("published"), false);
  assert.equal(isRecipeLocale("ar"), true);
  assert.equal(isRecipeLocale("de"), false);
});

test("groupRecipeTranslations buckets rows by recipe then locale", () => {
  const rows = [
    { recipe_id: "r1", locale: "en", name: "Espresso", description: "d", notes: null },
    { recipe_id: "r1", locale: "ar", name: "إسبريسو", description: null, notes: "n" },
    { recipe_id: "r2", locale: "en", name: "Cappuccino", description: null, notes: null },
  ];
  const grouped = groupRecipeTranslations(rows as never);
  assert.equal(grouped.r1?.en?.name, "Espresso");
  assert.equal(grouped.r1?.en?.description, "d");
  assert.equal(grouped.r1?.ar?.name, "إسبريسو");
  assert.equal(grouped.r1?.ar?.notes, "n");
  assert.equal(grouped.r2?.en?.name, "Cappuccino");
  assert.equal(grouped.missing, undefined);
});

test("resolveRecipeName falls back ar -> en -> fr (master)", () => {
  const translations: RecipeTranslationsMap = {
    en: { name: "Coffee latte", description: null, notes: null },
    ar: { name: "لاتيه", description: null, notes: null },
  };
  assert.equal(resolveRecipeName("Café au lait", translations, "ar"), "لاتيه");
  assert.equal(resolveRecipeName("Café au lait", translations, "en"), "Coffee latte");
  // FR is the master: it never yields to English.
  assert.equal(resolveRecipeName("Café au lait", translations, "fr"), "Café au lait");
  assert.equal(resolveRecipeName("Café au lait", translations, "unknown"), "Café au lait");

  // Without Arabic, the chain falls back to English, then the master.
  const enOnly: RecipeTranslationsMap = {
    en: { name: "Espresso", description: null, notes: null },
  };
  assert.equal(resolveRecipeName("Espresso", enOnly, "ar"), "Espresso");
  assert.equal(resolveRecipeName("Lait", {}, "ar"), "Lait");
  assert.equal(resolveRecipeName("Lait", {}, "en"), "Lait");
});

test("resolveRecipeDescription and resolveRecipeNotes follow the same chain", () => {
  const full: RecipeTranslationsMap = {
    en: {
      name: "Cappuccino",
      description: "With steamed milk.",
      notes: "Serve hot.",
    },
  };
  assert.equal(resolveRecipeDescription("Cappuccino", full, "en"), "With steamed milk.");
  assert.equal(resolveRecipeNotes("Cappuccino", full, "en"), "Serve hot.");
  assert.equal(resolveRecipeDescription("Cappuccino", {}, "ar"), "Cappuccino");
  assert.equal(resolveRecipeNotes(null, {}, "fr"), null);
});

test("cycle detection: a direct self-loop is always a cycle", () => {
  const adjacency = subRecipeAdjacency([]);
  assert.equal(wouldCreateSubRecipeCycle(adjacency, "R", "R"), true);
});

test("cycle detection: sub-recipe that depends on the parent is rejected", () => {
  // Sauce (S) uses Espresso (E); adding Sauce into Espresso closes the loop.
  const adjacency = subRecipeAdjacency([
    { recipeId: "S", subRecipeId: "E" },
  ]);
  assert.equal(wouldCreateSubRecipeCycle(adjacency, "E", "S"), true);
});

test("cycle detection: independent sub-recipes are allowed", () => {
  // Milk (M) is independent of Espresso (E).
  const adjacency = subRecipeAdjacency([
    { recipeId: "S", subRecipeId: "M" },
    { recipeId: "S", subRecipeId: "E" },
  ]);
  assert.equal(wouldCreateSubRecipeCycle(adjacency, "E", "M"), false);
  assert.equal(wouldCreateSubRecipeCycle(adjacency, "M", "E"), false);
});

test("cycle detection: transitive bottom-up reachability", () => {
  // E -> S, S -> C. Adding E into C creates E -> S -> C -> E.
  const adjacency = subRecipeAdjacency([
    { recipeId: "E", subRecipeId: "S" },
    { recipeId: "S", subRecipeId: "C" },
  ]);
  assert.equal(wouldCreateSubRecipeCycle(adjacency, "C", "E"), true);
  // Adding E into S would also close the loop E -> S -> E.
  assert.equal(wouldCreateSubRecipeCycle(adjacency, "S", "E"), true);
});

test("isSubRecipeReachable is depth-capped and cycle-safe", () => {
  const adjacency = subRecipeAdjacency([
    { recipeId: "A", subRecipeId: "B" },
    { recipeId: "B", subRecipeId: "A" },
    { recipeId: "B", subRecipeId: "C" },
  ]);
  assert.equal(isSubRecipeReachable(adjacency, "A", "C"), true);
  assert.equal(isSubRecipeReachable(adjacency, "A", "Z"), false);
  assert.equal(isSubRecipeReachable(adjacency, "A", "A", 0), true);
  assert.equal(isSubRecipeReachable(adjacency, "A", "C", 1), false);
});

test("normalizer: converts g -> kg through the engine", () => {
  // Coffee recipe item: 10 g, ingredient base unit kg.
  assert.equal(
    normalizeRecipeItemQuantity({
      quantity: 10,
      unitId: "g",
      baseUnitId: "kg",
      conversions: catalog,
    }),
    0.01
  );
});

test("normalizer: same-unit and null-base cases", () => {
  assert.equal(
    normalizeRecipeItemQuantity({
      quantity: 5,
      unitId: "g",
      baseUnitId: "g",
      conversions: catalog,
    }),
    5
  );
  assert.equal(
    normalizeRecipeItemQuantity({
      quantity: 5,
      unitId: null,
      baseUnitId: "g",
      conversions: catalog,
    }),
    5
  );
});

test("normalizer: incompatible units / invalid input produce null", () => {
  assert.equal(
    normalizeRecipeItemQuantity({
      quantity: 5,
      unitId: "g",
      baseUnitId: "ml",
      conversions: catalog,
    }),
    null
  );
  assert.equal(
    normalizeRecipeItemQuantity({
      quantity: 0,
      unitId: "g",
      baseUnitId: "kg",
      conversions: catalog,
    }),
    null
  );
  assert.equal(
    normalizeRecipeItemQuantity({
      quantity: 5,
      unitId: "g",
      baseUnitId: null,
      conversions: catalog,
    }),
    null
  );
});

test("unit compatibility flags valid and invalid unit pairs", () => {
  assert.equal(isRecipeItemUnitCompatible("g", "kg", catalog), true);
  assert.equal(isRecipeItemUnitCompatible("ml", "L", catalog), true);
  assert.equal(isRecipeItemUnitCompatible("g", "ml", catalog), false);
  assert.equal(isRecipeItemUnitCompatible(null, "kg", catalog), true);
  assert.equal(isRecipeItemUnitCompatible("g", null, catalog), true);
});

test("recipe item cost: 0.700 TND for 10 g of coffee @ 70 TND/kg", () => {
  const cost = calculateRecipeItemRawCost({
    quantity: 10,
    unitId: "g",
    baseUnitId: "kg",
    costPerBaseUnit: 70,
    subRecipeCost: null,
    conversions: catalog,
  });
  assert.notEqual(cost, null);
  assert.equal(Math.abs((cost as number) - 0.7) < 1e-9, true);
});

test("recipe item cost: sub-recipe batches are multiplied", () => {
  const cost = calculateRecipeItemRawCost({
    quantity: 2,
    unitId: null,
    baseUnitId: null,
    costPerBaseUnit: null,
    subRecipeCost: 1.5,
    conversions: catalog,
  });
  assert.equal(cost, 3);
});

test("recipe item cost: missing data returns null", () => {
  assert.equal(
    calculateRecipeItemRawCost({
      quantity: 10,
      unitId: "g",
      baseUnitId: "kg",
      costPerBaseUnit: null,
      subRecipeCost: null,
      conversions: catalog,
    }),
    null
  );
  assert.equal(
    calculateRecipeItemRawCost({
      quantity: 10,
      unitId: "g",
      baseUnitId: "ml",
      costPerBaseUnit: 70,
      subRecipeCost: null,
      conversions: catalog,
    }),
    null
  );
});

test("raw recipe cost sums contributions and flags missing data", () => {
  const result = calculateRecipeRawCost({
    conversions: catalog,
    items: [
      {
        quantity: 10,
        unitId: "g",
        baseUnitId: "kg",
        costPerBaseUnit: 70,
        subRecipeCost: null,
        conversions: catalog,
      },
      {
        quantity: 2,
        unitId: null,
        baseUnitId: null,
        costPerBaseUnit: null,
        subRecipeCost: 1.5,
        conversions: catalog,
      },
    ],
  });
  assert.equal(result.rawCost, 3.7);
  assert.equal(result.missingData, false);
});

test("raw recipe cost marks missing data when an item cannot be valued", () => {
  const result = calculateRecipeRawCost({
    conversions: catalog,
    items: [
      {
        quantity: 10,
        unitId: "g",
        baseUnitId: "kg",
        costPerBaseUnit: null,
        subRecipeCost: null,
        conversions: catalog,
      },
    ],
  });
  assert.equal(result.rawCost, 0);
  assert.equal(result.missingData, true);
});

test("parseRecipeDecimal accepts comma and dot separators", () => {
  assert.equal(parseRecipeDecimal(""), null);
  assert.equal(parseRecipeDecimal("3,75"), 3.75);
  assert.equal(parseRecipeDecimal("3.75"), 3.75);
  assert.equal(parseRecipeDecimal("abc"), null);
});

test("filterUnitsCompatibleWith keeps compatible units", () => {
  const units: Unit[] = [
    { id: "g", symbol: "g", name: "Gramme", unit_type: "mass" },
    { id: "kg", symbol: "kg", name: "Kilogramme", unit_type: "mass" },
    { id: "ml", symbol: "ml", name: "Millilitre", unit_type: "volume" },
  ] as never;
  const filtered = filterUnitsCompatibleWith(units, "kg", catalog);
  assert.deepEqual(filtered.map((u) => u.id).sort(), ["g", "kg"]);
  assert.equal(filterUnitsCompatibleWith(units, null, catalog).length, 3);
});

test("recipeItemSchema requires exactly one of ingredient or sub-recipe", () => {
  const ok = recipeItemSchema.safeParse({
    quantity: 1,
    ingredientId: EST,
  });
  assert.equal(ok.success, true);

  const both = recipeItemSchema.safeParse({
    quantity: 1,
    ingredientId: EST,
    subRecipeId: RECIPE_ID,
  });
  assert.equal(both.success, false);

  const neither = recipeItemSchema.safeParse({ quantity: 1 });
  assert.equal(neither.success, false);
});

test("recipeItemSchema rejects invalid quantity and waste", () => {
  assert.equal(
    recipeItemSchema
      .safeParse({ quantity: 0, ingredientId: EST })
      .success,
    false
  );
  assert.equal(
    recipeItemSchema
      .safeParse({ quantity: -1, ingredientId: EST })
      .success,
    false
  );
  assert.equal(
    recipeItemSchema
      .safeParse({ quantity: 1, ingredientId: EST, wastePercentage: 101 })
      .success,
    false
  );
});

test("recipeItemsSchema rejects duplicate references within a recipe", () => {
  const dup = recipeItemsSchema.safeParse({
    establishmentId: EST,
    recipeId: RECIPE_ID,
    items: [
      { quantity: 1, ingredientId: EST },
      { quantity: 2, ingredientId: EST },
    ],
  });
  assert.equal(dup.success, false);
});

test("createRecipeSchema accepts a valid recipe with translations", () => {
  const parsed = createRecipeSchema.safeParse({
    establishmentId: EST,
    productId: PRODUCT_ID,
    name: "Espresso",
    yieldType: "exact_consumption",
    defaultYield: 1,
    translations: {
      en: { name: "Espresso" },
      ar: { name: "إسبريسو" },
    },
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.data.yieldType, "exact_consumption");
  assert.equal(parsed.data.translations?.en?.name, "Espresso");
});

test("createRecipeSchema rejects bad product uuid and empty names", () => {
  assert.equal(
    createRecipeSchema
      .safeParse({
        establishmentId: EST,
        productId: "bad",
        name: "Espresso",
        yieldType: "exact_consumption",
      })
      .success,
    false
  );
  assert.equal(
    createRecipeSchema
      .safeParse({
        establishmentId: EST,
        productId: PRODUCT_ID,
        name: "",
        yieldType: "exact_consumption",
      })
      .success,
    false
  );
});

test("updateRecipeSchema requires recipeId and optional core fields", () => {
  assert.equal(
    updateRecipeSchema
      .safeParse({ establishmentId: EST, recipeId: RECIPE_ID, name: "New name" })
      .success,
    true
  );
  assert.equal(
    updateRecipeSchema.safeParse({ establishmentId: EST }).success,
    false
  );
});

test("recipe DB constraints map to stable domain codes", () => {
  assert.equal(
    toAuthorizationError({ message: "system_recipe_protected" }).code,
    "SYSTEM_RECIPE_PROTECTED"
  );
  assert.equal(
    toAuthorizationError({ message: "recipe_items_reference_xor" }).code,
    "RECIPE_INVALID_ITEM"
  );
  assert.equal(
    toAuthorizationError({ message: "recipe_items_quantity_check" }).code,
    "RECIPE_INVALID_ITEM"
  );
  assert.equal(
    toAuthorizationError({ message: "uq_recipes_default_per_product" }).code,
    "RECIPE_DEFAULT_UNIQUE"
  );
  assert.equal(
    toAuthorizationError({
      message: "uq_recipes_establishment_product_version",
    }).code,
    "RECIPE_VERSION_EXISTS"
  );
  assert.equal(
    authorizationErrorKey("RECIPE_CYCLE"),
    "authorization.errors.recipeCycle"
  );
  assert.equal(
    authorizationErrorKey("RECIPE_EMPTY"),
    "authorization.errors.recipeEmpty"
  );
});