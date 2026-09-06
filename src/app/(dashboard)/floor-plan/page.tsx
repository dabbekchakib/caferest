import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import {
  listDiningAreas,
  listTables,
} from "@/services/tables-service";
import { FloorPlan } from "@/features/floor-plan/floor-plan";
import { getLocale } from "next-intl/server";
import { resolveDiningAreaName } from "@/lib/tables/translations";

export const metadata: Metadata = {
  title: "Floor plan",
};

export default async function FloorPlanPage() {
  await requirePagePermission("tables.floor_plan");
  const establishmentId = await requireCurrentEstablishment();

  const locale = await getLocale();
  const [areas, tables, canEdit, canCreate] = await Promise.all([
    listDiningAreas(establishmentId),
    listTables(establishmentId),
    hasPermission("tables.floor_plan"),
    hasPermission("tables.create"),
  ]);

  const resolvedAreas = areas.map((area) => ({
    ...area,
    name: resolveDiningAreaName(area, locale),
  }));

  return (
    <FloorPlan
      areas={resolvedAreas}
      tables={tables}
      canEdit={canEdit}
      canCreate={canCreate}
    />
  );
}