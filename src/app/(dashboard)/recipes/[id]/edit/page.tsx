import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { getRecipeWithItems } from "@/services/recipes-service";
import { listProducts } from "@/services/products-service";
import { listUnits } from "@/services/units-service";
import { RecipeForm } from "@/features/recipes/recipe-form";

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

  const [recipe, products, units, canUpdate] = await Promise.all([
    getRecipeWithItems(establishmentId, id),
    listProducts(establishmentId),
    listUnits(establishmentId),
    hasPermission("recipes.update"),
  ]);
  if (!recipe) notFound();

  return (
    <RecipeForm
      mode="edit"
      recipe={recipe}
      products={products}
      units={units}
      readOnly={!canUpdate}
    />
  );
}