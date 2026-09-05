import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import {
  getProduct,
  listTaxes,
  getTaxReference,
} from "@/services/products-service";
import {
  listRecipes,
  getRecipeCost,
} from "@/services/recipes-service";
import { listCategories } from "@/services/categories-service";
import { listUnits } from "@/services/units-service";
import { ProductDetail } from "@/features/products/product-detail";
import { ProductRecipeSection } from "@/features/recipes/product-recipe-section";
import { resolveCategoryName } from "@/lib/categories/translations";
import type { RecipeListViewItem } from "@/lib/recipes/types";

export const metadata: Metadata = {
  title: "Product details",
};

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("products.view");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const [product, categories, units, taxes, canUpdate, canDelete, canViewRecipes, canCreateRecipes] =
    await Promise.all([
      getProduct(establishmentId, id),
      listCategories(establishmentId),
      listUnits(establishmentId),
      listTaxes(establishmentId),
      hasPermission("products.update"),
      hasPermission("products.delete"),
      hasPermission("recipes.view"),
      hasPermission("recipes.create"),
    ]);
  if (!product) notFound();

  const category = categories.find((c) => c.id === product.category_id);
  const unit = units.find((u) => u.id === product.unit_id);

  let tax = taxes.find((tax) => tax.id === product.tax_id) ?? null;
  if (!tax && product.tax_id) {
    tax = await getTaxReference(establishmentId, product.tax_id);
  }

  let recipeSection: React.ReactNode = null;
  if (product.product_type === "composite" && canViewRecipes) {
    const [recipes, canViewCost] = await Promise.all([
      listRecipes(establishmentId, { productId: id }),
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
    recipeSection = (
      <ProductRecipeSection
        recipes={recipes}
        costs={costs}
        canViewCost={canViewCost}
        canCreate={canCreateRecipes}
      />
    );
  }

  return (
    <ProductDetail
      product={product}
      categoryLabel={
        category ? resolveCategoryName(category.name, category.translations, "fr") : null
      }
      unitName={unit ? `${unit.name}${unit.symbol ? ` (${unit.symbol})` : ""}` : null}
      taxLabel={
        tax
          ? `${tax.name} · ${new Intl.NumberFormat("fr-FR", {}).format(tax.rate)} %`
          : null
      }
      canUpdate={canUpdate}
      canDelete={canDelete}
      recipeSection={recipeSection}
    />
  );
}