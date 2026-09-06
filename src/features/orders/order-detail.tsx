"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Clock, MapPin, User, NotebookPen, History, ChevronLeft } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge, type StatusVariant } from "@/components/shared/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { useToast } from "@/stores/use-toast-store";
import {
  transitionPosOrderAction,
  cancelPosOrderAction,
} from "@/features/pos/actions";
import { formatCurrency } from "@/lib/format";
import { ORDER_WORKFLOW } from "@/lib/orders/workflow";
import type {
  PosOrderDetail,
  PosOrderStatus,
  PosOrderStatusEvent,
  PosAreaRef,
} from "@/lib/pos/types";

interface OrderDetailViewProps {
  order: PosOrderDetail;
  history: PosOrderStatusEvent[];
  references: PosAreaRef[];
  canUpdate: boolean;
  canCancel: boolean;
}

interface OrderAction {
  to: PosOrderStatus;
  labelKey: string;
  variant: "primary" | "outline" | "success" | "danger";
}

const ACTION_LABELS: Partial<Record<PosOrderStatus, string>> = {
  open: "actionOpen",
  confirmed: "actionConfirm",
  preparing: "actionPrepare",
  ready: "actionReady",
  served: "actionServe",
  completed: "actionComplete",
};

const STATUS_VALUES: Record<PosOrderStatus, string> = {
  draft: "draft",
  open: "open",
  pending: "pending",
  confirmed: "confirmed",
  preparing: "preparing",
  ready: "ready",
  served: "served",
  completed: "completed",
  cancelled: "cancelled",
};

function statusVariant(status: PosOrderStatus): StatusVariant {
  switch (status) {
    case "draft":
      return "muted";
    case "open":
      return "warning";
    case "pending":
      return "muted";
    case "confirmed":
      return "info";
    case "preparing":
      return "warning";
    case "ready":
      return "success";
    case "served":
      return "success";
    case "completed":
      return "primary";
    case "cancelled":
      return "danger";
    default:
      return "muted";
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] py-2.5 last:border-0">
      <dt className="text-sm text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="text-end text-sm font-medium">{children}</dd>
    </div>
  );
}

export function OrderDetailView({
  order,
  history,
  references,
  canUpdate,
  canCancel,
}: OrderDetailViewProps) {
  const t = useTranslations("orders");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const availableActions = useMemo<OrderAction[]>(() => {
    const targets = ORDER_WORKFLOW[order.status];
    const actions: OrderAction[] = [];
    for (const to of targets) {
      if (!canUpdate && to !== "cancelled") continue;
      if (to === "cancelled" && !canCancel) continue;
      const labelKey = ACTION_LABELS[to];
      if (!labelKey) continue;
      const variant: OrderAction["variant"] =
        to === "cancelled"
          ? "danger"
          : to === "completed"
            ? "success"
            : to === "confirmed"
              ? "primary"
              : "outline";
      actions.push({ to, labelKey, variant });
    }
    return actions;
  }, [order.status, canUpdate, canCancel]);

  const tableRef = (() => {
    for (const area of references) {
      const table = area.tables.find((t) => t.id === order.tableId);
      if (table) return { table, areaName: area.name };
    }
    return null;
  })();

  const runTransition = useCallback(
    async (to: PosOrderStatus) => {
      setBusy(true);
      const result =
        to === "cancelled"
          ? await cancelPosOrderAction({ orderId: order.id })
          : await transitionPosOrderAction({ orderId: order.id, toStatus: to });
      setBusy(false);
      if (result.ok) {
        toast.success({
          title: t("statusToast", {
            number: order.orderNumber,
            status: t(`status${cap(STATUS_VALUES[to])}`),
          }),
        });
        router.refresh();
      } else {
        toast.error({
          title: tc("common.error"),
          description: tRoot(result.key ?? "authorization.errors.generic"),
        });
      }
    },
    [order.id, order.orderNumber, router, t, tc, tRoot, toast]
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={`${t("title")} · ${order.orderNumber}`}
        description={(() => {
          if (order.notes) return order.notes;
          return t("detailDescription");
        })()}
        breadcrumbs={[
          { label: tn("orders"), href: "/orders" },
          { label: order.orderNumber },
        ]}
        actions={
          <>
            <Link href="/orders">
              <Button variant="outline">
                <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
                {t("backToList")}
              </Button>
            </Link>
            <Link href="/pos">
              <Button variant="outline">
                <NotebookPen className="size-4" aria-hidden />
                {t("openInPos")}
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-6 lg:col-span-2">
          {/* Actions */}
          {availableActions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-1 text-sm font-medium text-[var(--color-muted-foreground)]">
                {t("actions")}:
              </span>
              {availableActions.map((action) => (
                <Button
                  key={action.to}
                  variant={action.variant}
                  loading={busy}
                  onClick={() => runTransition(action.to)}
                >
                  {t(action.labelKey)}
                </Button>
              ))}
            </div>
          )}

          {/* Articles */}
          <Card>
            <CardHeader>
              <CardTitle>{t("itemsTitle")}</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-[var(--color-border)] bg-[var(--color-muted)]">
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {t("product")}
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {t("qty")}
                    </th>
                    <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {t("unitPrice")}
                    </th>
                    <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {t("lineTotal")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--color-border)] last:border-0"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium">{item.productName}</span>
                        {item.notes && (
                          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                            {item.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">{item.quantity}</td>
                      <td className="px-4 py-3 text-end">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="px-4 py-3 text-end font-medium">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-1.5 border-t border-[var(--color-border)] p-4">
              <Row label={t("subtotal")}>
                {formatCurrency(order.subtotal)}
              </Row>
              {order.discountAmount > 0 && (
                <Row label={t("discount")}>
                  −{formatCurrency(order.discountAmount)}
                </Row>
              )}
              <Row label={t("taxes")}>{formatCurrency(order.taxAmount)}</Row>
              <div className="flex items-center justify-between gap-4 py-2">
                <span className="text-sm font-semibold">{t("total")}</span>
                <span className="text-lg font-bold text-[var(--color-primary)]">
                  {formatCurrency(order.total)}
                </span>
              </div>
            </div>
          </Card>

          {/* Historique */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <History className="size-4 text-[var(--color-muted-foreground)]" aria-hidden />
              <CardTitle>{t("historyTitle")}</CardTitle>
            </CardHeader>
            <div className="p-5">
              {history.length === 0 ? (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {t("noHistory")}
                </p>
              ) : (
                <ol className="relative ms-3 space-y-6 border-s border-[var(--color-border)] ps-6">
                  {history.map((event) => (
                    <li key={event.id} className="relative">
                      <span
                        className="absolute -start-[34px] top-1.5 size-2.5 rounded-full bg-[var(--color-primary)]"
                        aria-hidden
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          {t(`status${cap(STATUS_VALUES[event.status])}`)}
                        </span>
                        <time className="text-xs text-[var(--color-muted-foreground)]">
                          {new Date(event.createdAt).toLocaleString(locale, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}
                        </time>
                      </div>
                      <div className="mt-0.5 space-y-0.5 text-xs text-[var(--color-muted-foreground)]">
                        {event.userName && <span>{event.userName}</span>}
                        {event.reason && (
                          <p className="italic">« {event.reason} »</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Card>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <StatusBadge
                status={statusVariant(order.status)}
                label={t(`status${cap(STATUS_VALUES[order.status])}`)}
              />
              <span className="text-sm font-bold text-[var(--color-foreground)]">
                {order.orderNumber}
              </span>
            </div>
            <dl className="mt-3">
              <Row label={t("orderType")}>
                {t(`type${cap(order.orderType)}`)}
              </Row>
              <Row label={t("created")}>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden />
                  {new Date(order.createdAt).toLocaleString(locale, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>
              </Row>
              {order.tableNumber && (
                <Row label={t("table")}>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="size-3.5" aria-hidden />
                    {order.tableNumber}
                    {tableRef?.areaName ? ` · ${tableRef.areaName}` : ""}
                  </span>
                </Row>
              )}
              {order.customerName && (
                <Row label={t("customer")}>
                  <span className="inline-flex items-center gap-1">
                    <User className="size-3.5" aria-hidden />
                    {order.customerName}
                  </span>
                </Row>
              )}
              {order.serverName && (
                <Row label={t("server")}>{order.serverName}</Row>
              )}
              <Row label={t("itemsCount")}>{order.itemsCount}</Row>
            </dl>
          </Card>

          {order.notes && (
            <Card className="p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <NotebookPen className="size-4" aria-hidden />
                {t("notes")}
              </h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-muted-foreground)]">
                {order.notes}
              </p>
            </Card>
          )}

          {availableActions.length === 0 && (
            <EmptyState
              title={t("noActions")}
              description={t("noActionsDescription")}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function cap(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
