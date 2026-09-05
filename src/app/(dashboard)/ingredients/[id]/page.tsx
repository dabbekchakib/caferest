import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import {
  getIngredient,
  getIngredientCostPerBaseUnit,
} from "@/services/ingredients-service";
import {
  listRecipesUsingIngredient,
  getRecipeCost,
} from "@/services/recipes-service";
import { listCategories } from "@/services/categories-service";
import { listUnits } from "@/services/units-service";
import { IngredientDetail } from "@/features/ingredients/ingredient-detail";
import { ProductRecipeSection } from "@/features/recipes/product-recipe-section";
import { resolveCategoryName } from "@/lib/categories/translations";
import type { RecipeListViewItem } from "@/lib/recipes/types";

export const metadata: Metadata = {
  title: "Ingredient details",
};

export default async function IngredientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("ingredients.view");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const [ingredient, categories, units, canUpdate, canDelete, canViewRecipes, canCreateRecipes] =
    await Promise.all([
      getIngredient(establishmentId, id),
      listCategories(establishmentId),
      listUnits(establishmentId),
      hasPermission("ingredients.update"),
      hasPermission("ingredients.delete"),
      hasPermission("recipes.view"),
      hasPermission("recipes.create"),
    ]);
  if (!ingredient) notFound();

  const cost = await getIngredientCostPerBaseUnit(establishmentId, ingredient);

  const category = categories.find((c) => c.id === ingredient.category_id);
  const baseUnit = units.find((u) => u.id === ingredient.base_unit_id);
  const purchaseUnit = units.find((u) => u.id === ingredient.purchase_unit_id);

  let recipeSection: React.ReactNode = null;
  if (canViewRecipes) {
    const [recipes, canViewCost] = await Promise.all([
      listRecipesUsingIngredient(establishmentId, ingredient.id),
      hasPermission("recipes.cost-view"),
    ]);
    const costEntries =
      canViewCost && recipes.length > 0
        ? await Promise.all(
            recipes.map(async (recipe: RecipeListViewItem) => [
              recipe.id,
              (await getRecipeCost(establishmentId, recipe.id)).rawCost,
            ] as const)
          )
        : [];
    const costs = Object.fromEntries(costEntries);
    recipeSection = (
      <ProductRecipeSection
        recipes={recipes}
        costs={costs}
        canViewCost={canViewCost}
        canCreate={canCreateRecipes}
        titleNamespace="ingredients"
        showProduct
      />
    );
  }

  const unitLabel = (unit: { name: string; symbol: string | null } | undefined) =>
    unit ? (unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name) : null;

  return (
    <IngredientDetail
      ingredient={ingredient}
      categoryLabel={
        category
          ? resolveCategoryName(category.name, category.translations, "fr")
          : null
      }
      baseUnitLabel={unitLabel(baseUnit)}
      purchaseUnitLabel={unitLabel(purchaseUnit)}
      costPerBaseUnit={cost}
      canUpdate={canUpdate}
      canDelete={canDelete}
      recipeSection={recipeSection}
    />
  );
}