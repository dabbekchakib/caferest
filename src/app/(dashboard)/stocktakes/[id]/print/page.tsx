import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { getStocktake } from "@/services/stocktakes-service";
import { getDefaultCurrencyCode } from "@/features/purchases/default-currency";
import { StocktakePrint } from "@/features/stocktakes/stocktake-print";

export const metadata: Metadata = {
  title: "Stocktake print",
};

export default async function StocktakePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("stocktakes.view");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const [stocktake, currency] = await Promise.all([
    getStocktake(establishmentId, id),
    getDefaultCurrencyCode(establishmentId),
  ]);
  if (!stocktake) notFound();

  return <StocktakePrint stocktake={stocktake} currency={currency} />;
}