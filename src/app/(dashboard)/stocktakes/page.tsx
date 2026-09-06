import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { getStocktakesPage, listInventoryLocations } from "@/services/stocktakes-service";
import { StocktakeList } from "@/features/stocktakes/stocktake-list";
import { STOCKTAKE_STATUSES, STOCKTAKE_MODES } from "@/lib/stocktakes/status";
import type { StocktakeStatus, StocktakeMode } from "@/lib/stocktakes/types";

export const metadata: Metadata = {
  title: "Stocktakes",
};

const VALID_STATUSES = new Set<string>(STOCKTAKE_STATUSES);
const VALID_MODES = new Set<string>(STOCKTAKE_MODES);

export default async function StocktakesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    mode?: string;
    locationId?: string;
    page?: string;
  }>;
}) {
  await requirePagePermission("stocktakes.view");
  const establishmentId = await requireCurrentEstablishment();

  const sp = await searchParams;
  const status = VALID_STATUSES.has(sp.status ?? "")
    ? (sp.status as StocktakeStatus)
    : null;
  const mode = VALID_MODES.has(sp.mode ?? "")
    ? (sp.mode as StocktakeMode)
    : null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [result, locations, canCreate, canStart, canCount, canReview, canDelete] =
    await Promise.all([
      getStocktakesPage(establishmentId, {
        page,
        query: sp.q ?? null,
        status,
        mode,
        locationId: sp.locationId?.trim() || null,
      }),
      listInventoryLocations(establishmentId),
      hasPermission("stocktakes.create"),
      hasPermission("stocktakes.start"),
      hasPermission("stocktakes.count"),
      hasPermission("stocktakes.review"),
      hasPermission("stocktakes.delete"),
    ]);

  return (
    <StocktakeList
      result={result}
      query={sp.q ?? ""}
      status={status ?? "all"}
      mode={mode ?? "all"}
      locationId={sp.locationId ?? ""}
      locations={locations.map((location) => ({
        id: location.id,
        name: location.name,
        code: location.code,
      }))}
      canCreate={canCreate}
      canStart={canStart}
      canCount={canCount}
      canReview={canReview}
      canDelete={canDelete}
    />
  );
}