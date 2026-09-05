import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { listRecipes, getRecipeCost } from "@/services/recipes-service";
import { RecipeList } from "@/features/recipes/recipe-list";
import type { RecipeListViewItem } from "@/lib/recipes/types";

export const metadata: Metadata = {
  title: "Recipes",
};

export default async function RecipesPage() {
  await requirePagePermission("recipes.view");
  const establishmentId = await requireCurrentEstablishment();

  const [recipes, canCreate, canViewCost] = await Promise.all([
    listRecipes(establishmentId),
    hasPermission("recipes.create"),
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

  return (
    <RecipeList
      recipes={recipes}
      costs={costs}
      canCreate={canCreate}
      canViewCost={canViewCost}
    />
  );
}