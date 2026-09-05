import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { listCategories } from "@/services/categories-service";
import { CategoryForm } from "@/features/categories/category-form";

export const metadata: Metadata = {
  title: "New category",
};

export default async function CreateCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ parentId?: string }>;
}) {
  await requirePagePermission("categories.create");
  const establishmentId = await requireCurrentEstablishment();
  const { parentId } = await searchParams;

  const categories = await listCategories(establishmentId);

  return (
    <CategoryForm
      mode="create"
      allCategories={categories}
      initialParentId={parentId ?? null}
    />
  );
}