import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { listConversions } from "@/services/unit-conversions-service";
import { listUnits } from "@/services/units-service";
import { ConversionsList } from "@/features/unit-conversions/conversions-list";

export const metadata: Metadata = {
  title: "Unit conversions",
};

export default async function UnitConversionsPage() {
  await requirePagePermission("unit_conversions.view");
  const establishmentId = await requireCurrentEstablishment();

  const [conversions, units, canCreate, canUpdate, canDelete] =
    await Promise.all([
      listConversions(establishmentId),
      listUnits(establishmentId),
      hasPermission("unit_conversions.create"),
      hasPermission("unit_conversions.update"),
      hasPermission("unit_conversions.delete"),
    ]);

  return (
    <ConversionsList
      conversions={conversions}
      units={units}
      establishmentId={establishmentId}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  );
}