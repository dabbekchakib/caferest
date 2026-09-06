import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { getStockAdjustmentsPage, listInventoryLocations } from "@/services/stock-adjustments-service";
import { StockAdjustmentList } from "@/features/stock-adjustments/adjustment-list";
import {
  STOCK_ADJUSTMENT_STATUSES,
  STOCK_ADJUSTMENT_TYPES,
} from "@/lib/stock-adjustments/status";
import type {
  StockAdjustmentStatus,
  StockAdjustmentType,
} from "@/lib/stock-adjustments/types";

export const metadata: Metadata = {
  title: "Stock adjustments",
};

const VALID_STATUSES = new Set<string>(STOCK_ADJUSTMENT_STATUSES);
const VALID_TYPES = new Set<string>(STOCK_ADJUSTMENT_TYPES);

export default async function StockAdjustmentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    type?: string;
    locationId?: string;
    page?: string;
  }>;
}) {
  await requirePagePermission("stock_adjustments.view");
  const establishmentId = await requireCurrentEstablishment();

  const sp = await searchParams;
  const status = VALID_STATUSES.has(sp.status ?? "")
    ? (sp.status as StockAdjustmentStatus)
    : null;
  const type = VALID_TYPES.has(sp.type ?? "")
    ? (sp.type as StockAdjustmentType)
    : null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [result, locations, canCreate, canDelete] = await Promise.all([
    getStockAdjustmentsPage(establishmentId, {
      page,
      query: sp.q ?? null,
      status,
      type,
      locationId: sp.locationId?.trim() || null,
    }),
    listInventoryLocations(establishmentId),
    hasPermission("stock_adjustments.create"),
    hasPermission("stock_adjustments.delete"),
  ]);

  return (
    <StockAdjustmentList
      result={result}
      query={sp.q ?? ""}
      status={status ?? "all"}
      type={type ?? "all"}
      locationId={sp.locationId ?? ""}
      locations={locations.map((location) => ({
        id: location.id,
        name: location.name,
        code: location.code,
      }))}
      canCreate={canCreate}
      canDelete={canDelete}
    />
  );
}