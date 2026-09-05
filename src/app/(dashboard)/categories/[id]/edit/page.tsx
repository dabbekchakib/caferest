import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { getCategory, listCategories } from "@/services/categories-service";
import { CategoryForm } from "@/features/categories/category-form";

export const metadata: Metadata = {
  title: "Edit category",
};

export default async function EditCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("categories.update");
  const establishmentId = await requireCurrentEstablishment();

  const { id } = await params;
  const [category, allCategories] = await Promise.all([
    getCategory(establishmentId, id),
    listCategories(establishmentId),
  ]);
  if (!category) notFound();

  return (
    <CategoryForm
      mode="edit"
      category={category}
      allCategories={allCategories}
    />
  );
}