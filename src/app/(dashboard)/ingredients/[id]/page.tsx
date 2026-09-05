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
import { listCategories } from "@/services/categories-service";
import { listUnits } from "@/services/units-service";
import { IngredientDetail } from "@/features/ingredients/ingredient-detail";
import { resolveCategoryName } from "@/lib/categories/translations";

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

  const [ingredient, categories, units, canUpdate, canDelete] =
    await Promise.all([
      getIngredient(establishmentId, id),
      listCategories(establishmentId),
      listUnits(establishmentId),
      hasPermission("ingredients.update"),
      hasPermission("ingredients.delete"),
    ]);
  if (!ingredient) notFound();

  const cost = await getIngredientCostPerBaseUnit(establishmentId, ingredient);

  const category = categories.find((c) => c.id === ingredient.category_id);
  const baseUnit = units.find((u) => u.id === ingredient.base_unit_id);
  const purchaseUnit = units.find((u) => u.id === ingredient.purchase_unit_id);

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
    />
  );
}