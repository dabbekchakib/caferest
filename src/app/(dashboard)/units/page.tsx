import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { listUnits } from "@/services/units-service";
import { UnitsList } from "@/features/units/units-list";

export const metadata: Metadata = {
  title: "Units",
};

export default async function UnitsPage() {
  await requirePagePermission("units.view");
  const establishmentId = await requireCurrentEstablishment();

  const [units, canCreate, canUpdate, canDelete] = await Promise.all([
    listUnits(establishmentId),
    hasPermission("units.create"),
    hasPermission("units.update"),
    hasPermission("units.delete"),
  ]);

  return (
    <UnitsList
      units={units}
      establishmentId={establishmentId}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
    />
  );
}