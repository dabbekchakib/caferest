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
import { RecipeDetail } from "@/features/recipes/recipe-detail";

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

  const [canUpdate, canDelete, canActivate, canArchive, canViewCost, versionEntries] =
    await Promise.all([
      hasPermission("recipes.update"),
      hasPermission("recipes.delete"),
      hasPermission("recipes.activate"),
      hasPermission("recipes.archive"),
      hasPermission("recipes.cost-view"),
      listRecipeVersions(establishmentId, recipe.id),
    ]);

  const cost = canViewCost ? await getRecipeCost(establishmentId, recipe.id) : null;

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
    />
  );
}