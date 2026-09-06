import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { createClient } from "@/lib/supabase/server";
import { getSettingsMap } from "@/services/settings";
import { StockAdjustmentCreateForm } from "@/features/stock-adjustments/adjustment-create-form";
import { adjustmentThresholdsFromSettings } from "@/lib/stock-adjustments/thresholds";
import { getDefaultCurrencyCode } from "@/features/purchases/default-currency";

export const metadata: Metadata = {
  title: "New stock adjustment",
};

export default async function StockAdjustmentCreatePage() {
  await requirePagePermission("stock_adjustments.create");
  const establishmentId = await requireCurrentEstablishment();

  const supabase = await createClient();
  const [settings, currency] = await Promise.all([
    getSettingsMap(supabase, establishmentId),
    getDefaultCurrencyCode(establishmentId),
  ]);
  const thresholds = adjustmentThresholdsFromSettings(settings);

  return <StockAdjustmentCreateForm thresholds={thresholds} currency={currency} />;
}