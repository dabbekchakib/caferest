import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  requirePermission,
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { getGoodsReceipt } from "@/services/receiving-service";
import { isReceiptEditable } from "@/lib/receiving/status";
import { GoodsReceiptForm } from "@/features/receiving/goods-receipt-form";

export const metadata: Metadata = {
  title: "Edit goods receipt",
};

export default async function EditGoodsReceiptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("goods_receipts.view");
  await requirePermission("goods_receipts.update");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const receipt = await getGoodsReceipt(establishmentId, id);
  if (!receipt) notFound();
  if (!isReceiptEditable(receipt.status)) {
    redirect(`/receipts/${id}`);
  }

  return <GoodsReceiptForm mode="edit" receipt={receipt} />;
}