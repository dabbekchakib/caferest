import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { getIngredient } from "@/services/ingredients-service";
import { listCategories } from "@/services/categories-service";
import { listUnits } from "@/services/units-service";
import { getConversionsCached } from "@/services/units-cache";
import { IngredientForm } from "@/features/ingredients/ingredient-form";

export const metadata: Metadata = {
  title: "Edit ingredient",
};

export default async function EditIngredientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("ingredients.update");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const [ingredient, categories, units, catalog] = await Promise.all([
    getIngredient(establishmentId, id),
    listCategories(establishmentId),
    listUnits(establishmentId),
    getConversionsCached(establishmentId),
  ]);
  if (!ingredient) notFound();

  return (
    <IngredientForm
      mode="edit"
      ingredient={ingredient}
      categories={categories}
      units={units}
      conversions={catalog}
    />
  );
}