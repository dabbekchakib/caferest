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
  getStockAdjustment,
  getStockAdjustmentMovements,
  listAdjustmentIngredients,
} from "@/services/stock-adjustments-service";
import { StockAdjustmentDetail } from "@/features/stock-adjustments/adjustment-detail";
import { adjustmentThresholdsFromSettings } from "@/lib/stock-adjustments/thresholds";
import { getDefaultCurrencyCode } from "@/features/purchases/default-currency";
import type { StockAdjustmentAction } from "@/lib/stock-adjustments/status";

export const metadata: Metadata = {
  title: "Stock adjustment",
};

export default async function StockAdjustmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("stock_adjustments.view");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const adjustment = await getStockAdjustment(establishmentId, id);
  if (!adjustment) notFound();

  const supabase = await createClient();

  const [
    movements,
    settings,
    ingredients,
    pSubmit,
    pApprove,
    pValidate,
    pCancel,
    pDelete,
    pUpdate,
    currency,
  ] = await Promise.all([
    getStockAdjustmentMovements(establishmentId, id),
    getSettingsMap(supabase, establishmentId),
    listAdjustmentIngredients(establishmentId),
    hasPermission("stock_adjustments.submit"),
    hasPermission("stock_adjustments.approve"),
    hasPermission("stock_adjustments.validate"),
    hasPermission("stock_adjustments.cancel"),
    hasPermission("stock_adjustments.delete"),
    hasPermission("stock_adjustments.update"),
    getDefaultCurrencyCode(establishmentId),
  ]);

  const thresholds = adjustmentThresholdsFromSettings(settings);

  const actionPermissions: Record<StockAdjustmentAction, boolean> = {
    submit: pSubmit,
    approve: pApprove,
    validate: pValidate,
    cancel: pCancel,
    delete: pDelete,
  };

  return (
    <StockAdjustmentDetail
      adjustment={adjustment}
      movements={movements}
      ingredients={ingredients}
      thresholds={thresholds}
      actionPermissions={actionPermissions}
      canEdit={pUpdate}
      currency={currency}
    />
  );
}