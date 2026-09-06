import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/shared/page-header";
import { requireCurrentEstablishment } from "@/services/authorization";
import { listOpenOrders, listRecentOrders } from "@/services/pos-service";
import {
  computeDashboardStats,
  revenueByDay,
  revenueByType,
} from "@/lib/dashboard/metrics";
import { SALE_TYPES } from "@/lib/pos/config";
import { DashboardView } from "@/features/dashboard/dashboard-view";

export const metadata: Metadata = {
  title: "Dashboard",
};

const DAY_LABEL_KEYS = [
  "daySun",
  "dayMon",
  "dayTue",
  "dayWed",
  "dayThu",
  "dayFri",
  "daySat",
] as const;

const TYPE_LABEL_KEYS: Record<(typeof SALE_TYPES)[number], string> = {
  dine_in: "typeDine_in",
  takeaway: "typeTakeaway",
  delivery: "typeDelivery",
  counter: "typeCounter",
};

export default async function DashboardPage() {
  const establishmentId = await requireCurrentEstablishment();

  const [recentOrders, openOrders] = await Promise.all([
    listRecentOrders(establishmentId, 300),
    listOpenOrders(establishmentId),
  ]);

  const now = new Date();
  const stats = computeDashboardStats(recentOrders, openOrders.length, now);
  const trend = revenueByDay(recentOrders, now, 7);
  const byType = revenueByType(recentOrders, now);

  const t = await getTranslations("dashboard");
  const tn = await getTranslations("navigation");
  const to = await getTranslations("orders");

  const trendData = trend.map((bucket) => bucket.total);
  const trendLabels = trend.map(
    (bucket) => t(DAY_LABEL_KEYS[new Date(bucket.dayStart).getDay()])
  );
  const typeData = SALE_TYPES.map((type) => byType[type] ?? 0);
  const typeLabels = SALE_TYPES.map((type) => to(TYPE_LABEL_KEYS[type]));

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: tn("dashboard") }]}
      />

      <DashboardView
        stats={{
          revenue: stats.revenue,
          orders: stats.ordersCount,
          averageOrder: stats.averageOrder,
          productsSold: stats.productsSold,
          openOrders: stats.openOrdersCount,
        }}
        trendData={trendData}
        trendLabels={trendLabels}
        periodLabel={t("last7Days")}
        typeData={typeData}
        typeLabels={typeLabels}
        recentOrders={recentOrders.slice(0, 8)}
        openOrders={openOrders.slice(0, 6)}
      />
    </div>
  );
}