import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { listRecentOrders } from "@/services/pos-service";
import { OrdersView } from "@/features/pos/orders-view";
import { PageHeader } from "@/components/shared/page-header";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Commandes",
};

export default async function OrdersPage() {
  await requirePagePermission("orders.view");
  const establishmentId = await requireCurrentEstablishment();

  const [orders, canCancel, canConfirm] = await Promise.all([
    listRecentOrders(establishmentId, 50),
    hasPermission("orders.cancel"),
    hasPermission("orders.update"),
  ]);

  const t = await getTranslations("orders");
  const tNav = await getTranslations("navigation");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        description={t("recentDescription")}
        breadcrumbs={[{ label: tNav("orders") }]}
        actions={
          <Link
            href="/pos"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[var(--color-primary)] px-4 text-sm font-medium text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary)]/90"
          >
            {t("create")}
          </Link>
        }
      />
      <OrdersView orders={orders} canCancel={canCancel} canConfirm={canConfirm} />
    </div>
  );
}