import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { getTable, listDiningAreas } from "@/services/tables-service";
import { TableForm } from "@/features/tables/table-form";
import { getLocale } from "next-intl/server";
import { resolveDiningAreaName } from "@/lib/tables/translations";

export const metadata: Metadata = {
  title: "Edit table",
};

export default async function EditTablePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("tables.update");
  const establishmentId = await requireCurrentEstablishment();

  const { id } = await params;
  const locale = await getLocale();
  const canViewAreas = await hasPermission("dining_areas.view");
  const [table, areaItems] = await Promise.all([
    getTable(establishmentId, id),
    canViewAreas ? listDiningAreas(establishmentId) : Promise.resolve([]),
  ]);
  if (!table) notFound();

  const areas = areaItems.map((area) => ({
    id: area.id,
    name: resolveDiningAreaName(area, locale),
  }));

  return <TableForm mode="edit" table={table} areas={areas} />;
}