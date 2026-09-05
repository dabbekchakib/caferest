import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { getRecipeWithItems } from "@/services/recipes-service";
import { getRecipeYield } from "@/services/yields-service";
import { listProducts } from "@/services/products-service";
import { getCatalogCached } from "@/services/units-cache";
import { RecipeForm } from "@/features/recipes/recipe-form";
import { RecipeBuilder } from "@/features/recipes/recipe-builder";
import { RecipeYieldSection } from "@/features/recipes/recipe-yield-section";
import { Card } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Edit recipe",
};

export default async function EditRecipePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("recipes.update");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;
  const t = await getTranslations("recipeForm");

  const [recipe, products, catalog, canUpdate, yieldView] = await Promise.all([
    getRecipeWithItems(establishmentId, id),
    listProducts(establishmentId),
    getCatalogCached(establishmentId),
    hasPermission("recipes.update"),
    getRecipeYield(establishmentId, id),
  ]);
  if (!recipe) notFound();

  return (
    <div className="space-y-6">
      <RecipeForm
        mode="edit"
        recipe={recipe}
        products={products}
        units={catalog.units}
        readOnly={!canUpdate}
      />
      {canUpdate && !recipe.is_system && (
        <>
          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">{t("sectionGeneral")}</h3>
            <RecipeBuilder
              recipeId={recipe.id}
              defaultItems={recipe.items}
              canUpdate
            />
          </Card>
          <RecipeYieldSection
            recipeId={recipe.id}
            row={yieldView?.row ?? null}
            units={catalog.units}
            conversions={catalog.conversions}
            canEdit
            canViewCost={canUpdate}
            batchCost={null}
          />
        </>
      )}
    </div>
  );
}