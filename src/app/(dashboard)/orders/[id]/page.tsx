import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import {
  getPosOrder,
  listOrderStatusHistory,
  listPosReferences,
} from "@/services/pos-service";
import { OrderDetailView } from "@/features/orders/order-detail";
import { getLocale } from "next-intl/server";

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Détail de la commande",
};

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;
  await requirePagePermission("orders.view");
  const establishmentId = await requireCurrentEstablishment();
  const locale = await getLocale();

  const order = await getPosOrder(establishmentId, id);
  if (!order) notFound();

  const [history, references, canUpdate, canCancel] = await Promise.all([
    listOrderStatusHistory(establishmentId, id),
    listPosReferences(establishmentId, locale),
    hasPermission("orders.update"),
    hasPermission("orders.cancel"),
  ]);

  return (
    <OrderDetailView
      order={order}
      history={history}
      references={references}
      canUpdate={canUpdate}
      canCancel={canCancel}
    />
  );
}
