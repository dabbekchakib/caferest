import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { listCategories } from "@/services/categories-service";
import { listUnits } from "@/services/units-service";
import { listTaxes } from "@/services/products-service";
import { ProductForm } from "@/features/products/product-form";

export const metadata: Metadata = {
  title: "New product",
};

export default async function CreateProductPage() {
  await requirePagePermission("products.create");
  const establishmentId = await requireCurrentEstablishment();

  const [categories, units, taxes] = await Promise.all([
    listCategories(establishmentId),
    listUnits(establishmentId),
    listTaxes(establishmentId),
  ]);

  return (
    <ProductForm
      mode="create"
      categories={categories}
      units={units}
      taxes={taxes}
    />
  );
}