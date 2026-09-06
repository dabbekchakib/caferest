import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { listDiningAreas } from "@/services/tables-service";
import { TableForm } from "@/features/tables/table-form";
import { getLocale } from "next-intl/server";
import { resolveDiningAreaName } from "@/lib/tables/translations";

export const metadata: Metadata = {
  title: "New table",
};

export default async function CreateTablePage() {
  await requirePagePermission("tables.create");
  const establishmentId = await requireCurrentEstablishment();

  const locale = await getLocale();
  const canViewAreas = await hasPermission("dining_areas.view");
  const areas = canViewAreas
    ? (await listDiningAreas(establishmentId)).map((area) => ({
        id: area.id,
        name: resolveDiningAreaName(area, locale),
      }))
    : [];

  return <TableForm mode="create" areas={areas} />;
}