import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import {
  getGoodsReceipt,
  getGoodsReceiptStockMovements,
} from "@/services/receiving-service";
import { getDefaultCurrencyCode } from "@/features/purchases/default-currency";
import {
  GoodsReceiptDetail,
} from "@/features/receiving/goods-receipt-detail";
import type { GoodsReceiptAction } from "@/lib/receiving/status";

export const metadata: Metadata = {
  title: "Goods receipt",
};

export default async function GoodsReceiptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("goods_receipts.view");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const receipt = await getGoodsReceipt(establishmentId, id);
  if (!receipt) notFound();

  const [movements, pSubmit, pValidate, pCancel, canUpdate, canDelete, currency] =
    await Promise.all([
      getGoodsReceiptStockMovements(establishmentId, id),
      hasPermission("goods_receipts.submit"),
      hasPermission("goods_receipts.validate"),
      hasPermission("goods_receipts.cancel"),
      hasPermission("goods_receipts.update"),
      hasPermission("goods_receipts.delete"),
      getDefaultCurrencyCode(establishmentId),
    ]);

  const actionPermissions: Record<GoodsReceiptAction, boolean> = {
    submit: pSubmit,
    validate: pValidate,
    cancel: pCancel,
    delete: canDelete,
  };

  return (
    <GoodsReceiptDetail
      receipt={receipt}
      movements={movements}
      actionPermissions={actionPermissions}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canPrint={true}
      currency={currency}
    />
  );
}