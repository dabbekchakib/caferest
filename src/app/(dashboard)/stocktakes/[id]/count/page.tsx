import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { createClient } from "@/lib/supabase/server";
import { getSettingsMap } from "@/services/settings";
import {
  getStocktake,
  listStocktakeIngredients,
} from "@/services/stocktakes-service";
import { getDefaultCurrencyCode } from "@/features/purchases/default-currency";
import {
  stocktakeThresholdsFromSettings,
  isStocktakeLocationFrozen,
} from "@/lib/stocktakes/thresholds";
import { StocktakeCount } from "@/features/stocktakes/stocktake-count";

export const metadata: Metadata = {
  title: "Stocktake count",
};

export default async function StocktakeCountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("stocktakes.view");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const stocktake = await getStocktake(establishmentId, id);
  if (!stocktake) notFound();

  if (stocktake.status !== "draft" && stocktake.status !== "counting") {
    redirect(`/stocktakes/${id}`);
  }

  const supabase = await createClient();

  const [settings, ingredients, currency] = await Promise.all([
    getSettingsMap(supabase, establishmentId),
    listStocktakeIngredients(establishmentId),
    getDefaultCurrencyCode(establishmentId),
  ]);

  const thresholds = stocktakeThresholdsFromSettings(settings);
  const frozen = isStocktakeLocationFrozen(settings);

  return (
    <StocktakeCount
      stocktake={stocktake}
      thresholds={thresholds}
      frozen={frozen}
      ingredients={ingredients}
      currency={currency}
    />
  );
}