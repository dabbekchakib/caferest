import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { getDiningArea } from "@/services/tables-service";
import { DiningAreaForm } from "@/features/dining-areas/dining-area-form";

export const metadata: Metadata = {
  title: "Edit dining area",
};

export default async function EditDiningAreaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("dining_areas.update");
  const establishmentId = await requireCurrentEstablishment();

  const { id } = await params;
  const area = await getDiningArea(establishmentId, id);
  if (!area) notFound();

  return <DiningAreaForm mode="edit" area={area} />;
}