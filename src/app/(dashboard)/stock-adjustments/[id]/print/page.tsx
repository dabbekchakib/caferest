import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { getStockAdjustment } from "@/services/stock-adjustments-service";
import { getDefaultCurrencyCode } from "@/features/purchases/default-currency";
import { StockAdjustmentPrint } from "@/features/stock-adjustments/adjustment-print";

export const metadata: Metadata = {
  title: "Stock adjustment print",
};

export default async function StockAdjustmentPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("stock_adjustments.view");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const [adjustment, currency] = await Promise.all([
    getStockAdjustment(establishmentId, id),
    getDefaultCurrencyCode(establishmentId),
  ]);
  if (!adjustment) notFound();

  return <StockAdjustmentPrint adjustment={adjustment} currency={currency} />;
}