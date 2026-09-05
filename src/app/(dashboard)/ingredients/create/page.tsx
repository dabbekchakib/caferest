import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { listCategories } from "@/services/categories-service";
import { listUnits } from "@/services/units-service";
import { getConversionsCached } from "@/services/units-cache";
import { IngredientForm } from "@/features/ingredients/ingredient-form";

export const metadata: Metadata = {
  title: "New ingredient",
};

export default async function CreateIngredientPage() {
  await requirePagePermission("ingredients.create");
  const establishmentId = await requireCurrentEstablishment();

  const [categories, units, catalog] = await Promise.all([
    listCategories(establishmentId),
    listUnits(establishmentId),
    getConversionsCached(establishmentId),
  ]);

  return (
    <IngredientForm
      mode="create"
      categories={categories}
      units={units}
      conversions={catalog}
    />
  );
}