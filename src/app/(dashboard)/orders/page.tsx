import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { getOrdersPage } from "@/services/pos-service";
import { OrdersList } from "@/features/orders/orders-list";
import { PageHeader } from "@/components/shared/page-header";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { orderListFiltersSchema } from "@/lib/orders/schemas";

interface OrdersPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: "Commandes",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  await requirePagePermission("orders.view");
  const establishmentId = await requireCurrentEstablishment();

  const params = await searchParams;
  const filters = orderListFiltersSchema.safeParse({
    page: first(params.page) ? Number(first(params.page)) : 1,
    pageSize: 15,
    query: first(params.query) || null,
    status: first(params.status) || undefined,
    orderType: first(params.type) || undefined,
    tableId: first(params.table) || undefined,
    customerId: first(params.customer) || undefined,
  });

  const applied = filters.success
    ? filters.data
    : orderListFiltersSchema.parse({ page: 1 });

  const result = await getOrdersPage(establishmentId, applied);

  const t = await getTranslations("orders");
  const tNav = await getTranslations("navigation");

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t("title")}
        description={t("listDescription")}
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
      <OrdersList
        result={result}
        initialQuery={applied.query ?? ""}
        initialStatus={applied.status ?? ""}
        initialType={applied.orderType ?? ""}
      />
    </div>
  );
}
