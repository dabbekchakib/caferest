import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { createClient } from "@/lib/supabase/server";
import { getSettingsMap } from "@/services/settings";
import {
  getStocktake,
  getStocktakeStockMovements,
} from "@/services/stocktakes-service";
import { getDefaultCurrencyCode } from "@/features/purchases/default-currency";
import { stocktakeThresholdsFromSettings } from "@/lib/stocktakes/thresholds";
import { StocktakeDetail } from "@/features/stocktakes/stocktake-detail";
import type { StocktakeAction } from "@/lib/stocktakes/status";

export const metadata: Metadata = {
  title: "Stocktake",
};

export default async function StocktakeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("stocktakes.view");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const stocktake = await getStocktake(establishmentId, id);
  if (!stocktake) notFound();

  const supabase = await createClient();

  const [movements, settings, pStart, pComplete, pApprove, pValidate, pCancel, pDelete, currency] =
    await Promise.all([
      getStocktakeStockMovements(establishmentId, id),
      getSettingsMap(supabase, establishmentId),
      hasPermission("stocktakes.start"),
      hasPermission("stocktakes.review"),
      hasPermission("stocktakes.approve"),
      hasPermission("stocktakes.validate"),
      hasPermission("stocktakes.cancel"),
      hasPermission("stocktakes.delete"),
      getDefaultCurrencyCode(establishmentId),
    ]);

  const thresholds = stocktakeThresholdsFromSettings(settings);

  const actionPermissions: Record<StocktakeAction, boolean> = {
    start: pStart,
    complete: pComplete,
    approve: pApprove,
    validate: pValidate,
    cancel: pCancel,
    delete: pDelete,
  };

  return (
    <StocktakeDetail
      stocktake={stocktake}
      movements={movements}
      thresholds={thresholds}
      actionPermissions={actionPermissions}
      currency={currency}
    />
  );
}