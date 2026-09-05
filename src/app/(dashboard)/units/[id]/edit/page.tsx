import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { getUnit } from "@/services/units-service";
import { UnitForm } from "@/features/units/unit-form";

export const metadata: Metadata = {
  title: "Edit unit",
};

export default async function EditUnitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("units.update");
  const establishmentId = await requireCurrentEstablishment();

  const { id } = await params;
  const unit = await getUnit(establishmentId, id);
  if (!unit) notFound();

  return <UnitForm mode="edit" unit={unit} />;
}