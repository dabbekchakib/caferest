"use client";

import {
  ArrowUpRight,
  Banknote,
  Package,
  ShoppingCart,
  ListOrdered,
} from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineChart, BarChart } from "@/components/shared/charts";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/format";
import type { PosOrderStatus, PosOrderSummary } from "@/lib/pos/types";

export interface DashboardViewProps {
  stats: {
    revenue: number;
    orders: number;
    averageOrder: number;
    productsSold: number;
    openOrders: number;
  };
  trendData: number[];
  trendLabels: string[];
  periodLabel: string;
  typeData: number[];
  typeLabels: string[];
  recentOrders: PosOrderSummary[];
  openOrders: PosOrderSummary[];
}

const STATUS_LABEL_KEY: Record<PosOrderStatus, string> = {
  draft: "statusDraft",
  open: "statusOpen",
  pending: "statusPending",
  confirmed: "statusConfirmed",
  preparing: "statusPreparing",
  ready: "statusReady",
  served: "statusServed",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
};

export function DashboardView({
  stats,
  trendData,
  trendLabels,
  periodLabel,
  typeData,
  typeLabels,
  recentOrders,
  openOrders,
}: DashboardViewProps) {
  const t = useTranslations("dashboard");
  const to = useTranslations("orders");

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("revenue")}
          value={formatCurrency(stats.revenue)}
          icon={<Banknote className="size-5" aria-hidden />}
          hint={t("today")}
        />
        <StatCard
          label={t("orders")}
          value={String(stats.orders)}
          icon={<ShoppingCart className="size-5" aria-hidden />}
          hint={t("today")}
        />
        <StatCard
          label={t("averageOrder")}
          value={formatCurrency(stats.averageOrder)}
          icon={<ArrowUpRight className="size-5" aria-hidden />}
          hint={t("today")}
        />
        <StatCard
          label={t("productsSold")}
          value={String(stats.productsSold)}
          icon={<Package className="size-5" aria-hidden />}
          hint={t("today")}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{t("revenueTrend")}</CardTitle>
            <Badge variant="muted">{periodLabel}</Badge>
          </CardHeader>
          <CardContent>
            <LineChart data={trendData} labels={trendLabels} height={240} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("salesByType")}</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={typeData} labels={typeLabels} height={220} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{t("recentOrders")}</CardTitle>
            <Link href="/orders">
              <Button variant="ghost" size="sm">
                {t("viewAll")}
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <RecentOrdersTable orders={recentOrders} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{t("openOrders")}</CardTitle>
            <ListOrdered className="size-4 text-[var(--color-muted-foreground)]" aria-hidden />
          </CardHeader>
          <CardContent>
            {openOrders.length === 0 ? (
              <EmptyState
                title={t("noOpenOrders")}
                description={t("noOpenOrdersDescription")}
              />
            ) : (
              <ul className="space-y-3">
                {openOrders.map((order) => (
                  <li key={order.id}>
                    <Link
                      href={`/orders/${order.id}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] p-3 transition-colors hover:bg-[var(--color-muted)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">
                          {order.orderNumber}
                        </span>
                        <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
                          {to(`type${order.orderType[0].toUpperCase()}${order.orderType.slice(1)}`)}
                          {order.tableNumber ? ` · ${t("table")} ${order.tableNumber}` : ""}
                        </span>
                      </span>
                      <span className="text-sm font-semibold">
                        {formatCurrency(order.total)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function RecentOrdersTable({ orders }: { orders: PosOrderSummary[] }) {
  const t = useTranslations("dashboard");
  const to = useTranslations("orders");
  const router = useRouter();

  const columns: Column<PosOrderSummary>[] = [
    {
      key: "orderNumber",
      header: t("reference"),
      accessor: (r) => <span className="font-medium">{r.orderNumber}</span>,
      sortable: true,
    },
    {
      key: "table",
      header: t("table"),
      accessor: (r) =>
        r.tableNumber ? `${to("table")} ${r.tableNumber}` : "—",
      hideOnMobile: true,
      sortable: true,
      sortValue: (r) => r.tableNumber ?? "",
    },
    {
      key: "quantity",
      header: t("items"),
      accessor: (r) => r.quantity,
      sortable: true,
      sortValue: (r) => r.quantity,
    },
    {
      key: "total",
      header: t("total"),
      accessor: (r) => (
        <span className="font-semibold">{formatCurrency(r.total)}</span>
      ),
      sortable: true,
      sortValue: (r) => r.total,
    },
    {
      key: "status",
      header: t("status"),
      accessor: (r) => (
        <StatusBadge status={statusVariant(r.status)} label={to(STATUS_LABEL_KEY[r.status])} />
      ),
      sortable: true,
      sortValue: (r) => r.status,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={orders}
      rowKey={(r) => r.id}
      onRowClick={(r) => router.push(`/orders/${r.id}`)}
    />
  );
}

function statusVariant(status: PosOrderStatus) {
  switch (status) {
    case "completed":
    case "served":
      return "success";
    case "cancelled":
      return "danger";
    case "confirmed":
    case "preparing":
    case "ready":
      return "warning";
    case "pending":
    case "open":
      return "info";
    default:
      return "muted";
  }
}