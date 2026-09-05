import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import {
  getProduct,
  listTaxes,
  getTaxReference,
} from "@/services/products-service";
import { listCategories } from "@/services/categories-service";
import { listUnits } from "@/services/units-service";
import { ProductForm } from "@/features/products/product-form";

export const metadata: Metadata = {
  title: "Edit product",
};

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("products.update");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const [product, categories, units, taxes] = await Promise.all([
    getProduct(establishmentId, id),
    listCategories(establishmentId),
    listUnits(establishmentId),
    listTaxes(establishmentId),
  ]);
  if (!product) notFound();

  let mergedTaxes = taxes;
  const hasCurrent = product.tax_id === null || taxes.some((tax) => tax.id === product.tax_id);
  if (!hasCurrent && product.tax_id) {
    const current = await getTaxReference(establishmentId, product.tax_id);
    if (current) mergedTaxes = [...taxes, current];
  }

  return (
    <ProductForm
      mode="edit"
      product={product}
      categories={categories}
      units={units}
      taxes={mergedTaxes}
    />
  );
}