import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { getPurchaseOrder } from "@/services/purchases-service";
import { PurchaseOrderDetail } from "@/features/purchases/purchase-order-detail";
import type { PurchaseOrderAction } from "@/lib/purchases/status";

export const metadata: Metadata = {
  title: "Purchase order",
};

export default async function PurchaseOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("purchases.view");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const order = await getPurchaseOrder(establishmentId, id);
  if (!order) notFound();

  const [canUpdate, canDelete, canDuplicate, pSubmit, pApprove, pSend, pCancel, pClose] =
    await Promise.all([
      hasPermission("purchases.update"),
      hasPermission("purchases.delete"),
      hasPermission("purchases.duplicate"),
      hasPermission("purchases.submit"),
      hasPermission("purchases.approve"),
      hasPermission("purchases.send"),
      hasPermission("purchases.cancel"),
      hasPermission("purchases.close"),
    ]);

  const actionPermissions: Record<PurchaseOrderAction, boolean> = {
    submit: pSubmit,
    approve: pApprove,
    send: pSend,
    cancel: pCancel,
    close: pClose,
  };

  return (
    <PurchaseOrderDetail
      order={order}
      actionPermissions={actionPermissions}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canDuplicate={canDuplicate}
      canPrint={true}
    />
  );
}