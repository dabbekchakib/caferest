export const RECIPE_QUANTITY_MAX_DECIMALS = 3;
export const RECIPE_WASTE_MAX_DECIMALS = 0;
export const RECIPE_COST_MAX_DECIMALS = 3;

/** A recipe must carry at least one item before it can serve production. */
export const RECIPE_MIN_ITEMS_FOR_ACTIVE = 1;

/** Guard against runaway sub-recipe chains (cycle detection + costing). */
export const MAX_SUBRECIPE_DEPTH = 20;

export const SYSTEM_RECIPE_FILTER = { isSystem: false };

/** Stable ordering used by the status filter dropdown and list sorting. */
export const RECIPE_DISPATCH_ORDER = Object.freeze({
  draft: 10,
  active: 20,
  inactive: 30,
  archived: 40,
} as const);

export type RecipeStatusOrder = keyof typeof RECIPE_DISPATCH_ORDER;

export const RECIPE_STATUS_ORDER: readonly RecipeStatusOrder[] = Object.freeze(
  Object.keys(RECIPE_DISPATCH_ORDER) as RecipeStatusOrder[]
);