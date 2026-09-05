import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { listProducts } from "@/services/products-service";
import { listCategories } from "@/services/categories-service";
import { ProductList } from "@/features/products/product-list";

export const metadata: Metadata = {
  title: "Products",
};

export default async function ProductsPage() {
  await requirePagePermission("products.view");
  const establishmentId = await requireCurrentEstablishment();

  const [
    products,
    categories,
    canCreate,
    canUpdate,
    canDelete,
    canUpdatePrice,
    canUpdateStatus,
    canReorder,
  ] = await Promise.all([
    listProducts(establishmentId),
    listCategories(establishmentId),
    hasPermission("products.create"),
    hasPermission("products.update"),
    hasPermission("products.delete"),
    hasPermission("products.update-price"),
    hasPermission("products.update-status"),
    hasPermission("products.reorder"),
  ]);

  return (
    <ProductList
      products={products}
      categories={categories}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canUpdatePrice={canUpdatePrice}
      canUpdateStatus={canUpdateStatus}
      canReorder={canReorder}
    />
  );
}