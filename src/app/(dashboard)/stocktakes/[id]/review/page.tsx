import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { createClient } from "@/lib/supabase/server";
import { getSettingsMap } from "@/services/settings";
import { getStocktake } from "@/services/stocktakes-service";
import { getDefaultCurrencyCode } from "@/features/purchases/default-currency";
import { stocktakeThresholdsFromSettings } from "@/lib/stocktakes/thresholds";
import { StocktakeReview } from "@/features/stocktakes/stocktake-review";

export const metadata: Metadata = {
  title: "Stocktake review",
};

export default async function StocktakeReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("stocktakes.view");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const stocktake = await getStocktake(establishmentId, id);
  if (!stocktake) notFound();

  if (stocktake.status !== "counting" && stocktake.status !== "pending_review") {
    redirect(`/stocktakes/${id}`);
  }

  const supabase = await createClient();

  const [settings, currency] = await Promise.all([
    getSettingsMap(supabase, establishmentId),
    getDefaultCurrencyCode(establishmentId),
  ]);

  const thresholds = stocktakeThresholdsFromSettings(settings);

  return (
    <StocktakeReview
      stocktake={stocktake}
      thresholds={thresholds}
      currency={currency}
    />
  );
}