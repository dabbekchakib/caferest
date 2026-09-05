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
import { listCategories } from "@/services/categories-service";
import { listUnits } from "@/services/units-service";
import { ProductDetail } from "@/features/products/product-detail";
import { resolveCategoryName } from "@/lib/categories/translations";

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

  const [product, categories, units, taxes, canUpdate, canDelete] =
    await Promise.all([
      getProduct(establishmentId, id),
      listCategories(establishmentId),
      listUnits(establishmentId),
      listTaxes(establishmentId),
      hasPermission("products.update"),
      hasPermission("products.delete"),
    ]);
  if (!product) notFound();

  const category = categories.find((c) => c.id === product.category_id);
  const unit = units.find((u) => u.id === product.unit_id);

  let tax = taxes.find((tax) => tax.id === product.tax_id) ?? null;
  if (!tax && product.tax_id) {
    tax = await getTaxReference(establishmentId, product.tax_id);
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
    />
  );
}