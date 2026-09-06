import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { getGoodsReceipt } from "@/services/receiving-service";
import { getDefaultCurrencyCode } from "@/features/purchases/default-currency";
import { GoodsReceiptPrint } from "@/features/receiving/goods-receipt-print";

export const metadata: Metadata = {
  title: "Print goods receipt",
};

export default async function PrintGoodsReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("goods_receipts.view");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const receipt = await getGoodsReceipt(establishmentId, id);
  if (!receipt) notFound();

  const currency = await getDefaultCurrencyCode(establishmentId);

  return <GoodsReceiptPrint receipt={receipt} currency={currency} />;
}