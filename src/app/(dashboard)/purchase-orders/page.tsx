import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { getPurchaseOrdersPage } from "@/services/purchases-service";
import { listSuppliers } from "@/services/suppliers-service";
import { PURCHASE_ORDER_STATUSES } from "@/lib/purchases/status";
import type { PurchaseOrderStatus } from "@/lib/purchases/types";
import { PurchaseOrderList } from "@/features/purchases/purchase-order-list";
import { getDefaultCurrencyCode } from "@/features/purchases/default-currency";

export const metadata: Metadata = {
  title: "Purchase orders",
};

const VALID_STATUSES = new Set<string>(PURCHASE_ORDER_STATUSES);

export default async function PurchaseOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    supplier?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  await requirePagePermission("purchases.view");
  const establishmentId = await requireCurrentEstablishment();

  const sp = await searchParams;
  const status = VALID_STATUSES.has(sp.status ?? "")
    ? (sp.status as PurchaseOrderStatus)
    : null;
  const supplierId = sp.supplier?.trim() || null;
  const fromDate = sp.from?.trim() || null;
  const toDate = sp.to?.trim() || null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [result, suppliers, canCreate, canUpdate, canDelete, canDuplicate, currency] =
    await Promise.all([
      getPurchaseOrdersPage(establishmentId, {
        page,
        query: sp.q ?? null,
        supplierId,
        status,
        fromDate,
        toDate,
      }),
      listSuppliers(establishmentId, { activeOnly: true }),
      hasPermission("purchases.create"),
      hasPermission("purchases.update"),
      hasPermission("purchases.delete"),
      hasPermission("purchases.duplicate"),
      getDefaultCurrencyCode(establishmentId),
    ]);

  return (
    <PurchaseOrderList
      result={result}
      suppliers={suppliers.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
      query={sp.q ?? ""}
      status={status ?? "all"}
      supplier={supplierId ?? ""}
      fromDate={fromDate ?? ""}
      toDate={toDate ?? ""}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      canDuplicate={canDuplicate}
      currency={currency}
    />
  );
}