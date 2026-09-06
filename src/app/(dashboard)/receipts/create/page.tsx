import type { Metadata } from "next";
import {
  requirePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { GoodsReceiptForm } from "@/features/receiving/goods-receipt-form";

export const metadata: Metadata = {
  title: "New goods receipt",
};

export default async function CreateGoodsReceiptPage({
  searchParams,
}: {
  searchParams: Promise<{ po?: string }>;
}) {
  await requirePermission("goods_receipts.create");
  await requireCurrentEstablishment();
  const sp = await searchParams;

  return (
    <GoodsReceiptForm
      mode="create"
      receipt={null}
      initialPurchaseOrderId={sp.po?.trim() || null}
    />
  );
}