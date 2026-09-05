import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import {
  getRecipeWithItems,
  getRecipeCost,
  listRecipeVersions,
} from "@/services/recipes-service";
import { getRecipeYield, calculateTheoreticalConsumption } from "@/services/yields-service";
import { RecipeDetail } from "@/features/recipes/recipe-detail";
import { getCatalogCached } from "@/services/units-cache";

export const metadata: Metadata = {
  title: "Recipe details",
};

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("recipes.view");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const recipe = await getRecipeWithItems(establishmentId, id);
  if (!recipe) notFound();

  const [
    canUpdate,
    canDelete,
    canActivate,
    canArchive,
    canViewCost,
    canCreateYield,
    canUpdateYield,
    versionEntries,
    catalog,
    yieldRow,
  ] = await Promise.all([
    hasPermission("recipes.update"),
    hasPermission("recipes.delete"),
    hasPermission("recipes.activate"),
    hasPermission("recipes.archive"),
    hasPermission("recipes.cost-view"),
    hasPermission("recipe_yields.create"),
    hasPermission("recipe_yields.update"),
    listRecipeVersions(establishmentId, recipe.id),
    getCatalogCached(establishmentId),
    getRecipeYield(establishmentId, recipe.id),
  ]);

  const cost = canViewCost ? await getRecipeCost(establishmentId, recipe.id) : null;

  const canEditYield = canCreateYield || canUpdateYield;

  let initialConsumption = null;
  if (yieldRow?.row?.is_active) {
    const consumptionResult = await calculateTheoreticalConsumption(
      establishmentId,
      recipe.id
    );
    if (consumptionResult.consumed) {
      initialConsumption = consumptionResult;
    }
  }

  return (
    <RecipeDetail
      recipe={recipe}
      productLabel={versionEntries[0]?.productName ?? null}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canActivate={canActivate}
      canArchive={canArchive}
      canViewCost={canViewCost}
      cost={cost}
      versionEntries={versionEntries}
      yieldRow={yieldRow?.row ?? null}
      units={catalog.units}
      conversions={catalog.conversions}
      canEditYield={canEditYield}
      canViewCostYield={canViewCost}
      batchCost={cost?.rawCost ?? null}
      initialConsumption={initialConsumption}
    />
  );
}