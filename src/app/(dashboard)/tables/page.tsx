import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { getTablesPage, listDiningAreas } from "@/services/tables-service";
import { TableList } from "@/features/tables/table-list";
import { isDiningTableStatus } from "@/lib/tables/status";
import type { DiningTableStatus } from "@/lib/tables/types";
import { getLocale } from "next-intl/server";
import { resolveDiningAreaName } from "@/lib/tables/translations";

export const metadata: Metadata = {
  title: "Tables",
};

export default async function TablesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    areaId?: string;
    page?: string;
  }>;
}) {
  await requirePagePermission("tables.view");
  const establishmentId = await requireCurrentEstablishment();

  const { q, status, areaId, page } = await searchParams;
  const canViewAreas = await hasPermission("dining_areas.view");
  const locale = await getLocale();

  const [areaItems, canCreate, canUpdate, canDelete, canStatus] =
    await Promise.all([
      canViewAreas ? listDiningAreas(establishmentId) : Promise.resolve([]),
      hasPermission("tables.create"),
      hasPermission("tables.update"),
      hasPermission("tables.delete"),
      hasPermission("tables.status"),
    ]);

  const areas = areaItems.map((area) => ({
    id: area.id,
    name: resolveDiningAreaName(area, locale),
  }));

  const validatedStatus = isDiningTableStatus(status)
    ? (status as DiningTableStatus)
    : null;
  const validatedAreaId = areaId && areas.some((a) => a.id === areaId)
    ? areaId
    : null;
  const pageNumber = Number.parseInt(page ?? "1", 10);
  const safePage = Number.isFinite(pageNumber) && pageNumber > 0 ? pageNumber : 1;

  const result = await getTablesPage(establishmentId, {
    query: q ?? null,
    status: validatedStatus,
    areaId: validatedAreaId,
    page: safePage,
  });

  return (
    <TableList
      result={result}
      query={q ?? ""}
      status={validatedStatus ?? "all"}
      areaId={validatedAreaId ?? "all"}
      areas={areas}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canStatus={canStatus}
    />
  );
}