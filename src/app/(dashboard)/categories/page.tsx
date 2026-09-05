import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { listCategories } from "@/services/categories-service";
import { CategoryList } from "@/features/categories/category-list";

export const metadata: Metadata = {
  title: "Categories",
};

export default async function CategoriesPage() {
  await requirePagePermission("categories.view");
  const establishmentId = await requireCurrentEstablishment();

  const [categories, canCreate, canUpdate, canDelete, canReorder] =
    await Promise.all([
      listCategories(establishmentId),
      hasPermission("categories.create"),
      hasPermission("categories.update"),
      hasPermission("categories.delete"),
      hasPermission("categories.reorder"),
    ]);

  return (
    <CategoryList
      categories={categories}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canReorder={canReorder}
    />
  );
}