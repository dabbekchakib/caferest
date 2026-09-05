import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import {
  requirePermission,
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { getPurchaseOrder } from "@/services/purchases-service";
import { listSuppliers } from "@/services/suppliers-service";
import { listUnits } from "@/services/units-service";
import { listTaxes } from "@/services/products-service";
import { isOrderEditable } from "@/lib/purchases/status";
import { PurchaseOrderForm } from "@/features/purchases/purchase-order-form";
import { getDefaultCurrencyCode } from "@/features/purchases/default-currency";

export const metadata: Metadata = {
  title: "Edit purchase order",
};

export default async function EditPurchaseOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePagePermission("purchases.view");
  await requirePermission("purchases.update");
  const establishmentId = await requireCurrentEstablishment();
  const { id } = await params;

  const order = await getPurchaseOrder(establishmentId, id);
  if (!order) notFound();
  if (!isOrderEditable(order.status)) {
    redirect(`/purchase-orders/${id}`);
  }

  const [suppliers, taxes, units, defaultCurrency] = await Promise.all([
    listSuppliers(establishmentId, { activeOnly: true }),
    listTaxes(establishmentId),
    listUnits(establishmentId),
    getDefaultCurrencyCode(establishmentId),
  ]);

  return (
    <PurchaseOrderForm
      mode="edit"
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
      taxes={taxes.map((t) => ({ id: t.id, name: t.name, rate: t.rate }))}
      units={units.map((u) => ({ id: u.id, symbol: u.symbol }))}
      defaultCurrency={defaultCurrency}
      order={order}
    />
  );
}