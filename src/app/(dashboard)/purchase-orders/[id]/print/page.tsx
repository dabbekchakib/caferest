import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { getPurchaseOrder } from "@/services/purchases-service";
import { PurchaseOrderPrint } from "@/features/purchases/purchase-order-print";

export const metadata: Metadata = {
  title: "Print purchase order",
};

export default async function PrintPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("purchases.view");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const order = await getPurchaseOrder(establishmentId, id);
  if (!order) notFound();

  return <PurchaseOrderPrint order={order} />;
}