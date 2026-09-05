import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { listProducts } from "@/services/products-service";
import { listUnits } from "@/services/units-service";
import { RecipeForm } from "@/features/recipes/recipe-form";

export const metadata: Metadata = {
  title: "New recipe",
};

export default async function CreateRecipePage() {
  await requirePagePermission("recipes.create");
  const establishmentId = await requireCurrentEstablishment();

  const [products, units, canUpdate] = await Promise.all([
    listProducts(establishmentId),
    listUnits(establishmentId),
    hasPermission("recipes.update"),
  ]);

  return (
    <RecipeForm
      mode="create"
      products={products}
      units={units}
      readOnly={!canUpdate}
    />
  );
}