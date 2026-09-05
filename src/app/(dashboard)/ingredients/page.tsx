import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import {
  listIngredients,
  getIngredientCostPerBaseUnit,
} from "@/services/ingredients-service";
import { listCategories } from "@/services/categories-service";
import { listUnits } from "@/services/units-service";
import { IngredientList } from "@/features/ingredients/ingredient-list";
import type { IngredientWithTranslations } from "@/lib/ingredients/types";

export const metadata: Metadata = {
  title: "Ingredients",
};

export default async function IngredientsPage() {
  await requirePagePermission("ingredients.view");
  const establishmentId = await requireCurrentEstablishment();

  const [
    ingredients,
    categories,
    units,
    canCreate,
    canUpdate,
    canDelete,
    canUpdateCost,
    canUpdateStatus,
    canReorder,
  ] = await Promise.all([
    listIngredients(establishmentId),
    listCategories(establishmentId),
    listUnits(establishmentId),
    hasPermission("ingredients.create"),
    hasPermission("ingredients.update"),
    hasPermission("ingredients.delete"),
    hasPermission("ingredients.update-cost"),
    hasPermission("ingredients.update-status"),
    hasPermission("ingredients.reorder"),
  ]);

  const costs = await Promise.all(
    ingredients.map(async (ingredient: IngredientWithTranslations) => [
      ingredient.id,
      await getIngredientCostPerBaseUnit(establishmentId, ingredient),
    ] as const)
  );
  const costPerBaseUnit = Object.fromEntries(costs);

  const unitLabels = Object.fromEntries(
    units.map((unit) => [
      unit.id,
      unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name,
    ])
  );

  return (
    <IngredientList
      ingredients={ingredients}
      categories={categories}
      costPerBaseUnit={costPerBaseUnit}
      unitLabels={unitLabels}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canUpdateCost={canUpdateCost}
      canUpdateStatus={canUpdateStatus}
      canReorder={canReorder}
    />
  );
}