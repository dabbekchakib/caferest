import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { listDiningAreas } from "@/services/tables-service";
import { DiningAreaList } from "@/features/dining-areas/dining-area-list";

export const metadata: Metadata = {
  title: "Dining areas",
};

export default async function DiningAreasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePagePermission("dining_areas.view");
  const establishmentId = await requireCurrentEstablishment();

  const { q } = await searchParams;
  const [areas, canCreate, canUpdate, canDelete, canReorder] =
    await Promise.all([
      listDiningAreas(establishmentId),
      hasPermission("dining_areas.create"),
      hasPermission("dining_areas.update"),
      hasPermission("dining_areas.delete"),
      hasPermission("dining_areas.reorder"),
    ]);

  return (
    <DiningAreaList
      areas={areas}
      query={q ?? ""}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canReorder={canReorder}
    />
  );
}