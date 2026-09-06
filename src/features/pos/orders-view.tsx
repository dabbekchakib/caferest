"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { useToast } from "@/stores/use-toast-store";
import { useState } from "react";
import { cancelPosOrderAction, confirmPosOrderAction } from "./actions";
import { formatCurrency } from "@/lib/format";
import type { PosOrderSummary } from "@/lib/pos/types";

interface OrdersViewProps {
  orders: PosOrderSummary[];
  canCancel: boolean;
  canConfirm: boolean;
}

function statusVariant(status: string): "warning" | "success" | "danger" | "muted" {
  if (status === "open") return "warning";
  if (status === "confirmed") return "success";
  if (status === "cancelled") return "danger";
  return "muted";
}

export function OrdersView({ orders, canCancel, canConfirm }: OrdersViewProps) {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState(orders);

  function applyUpdate(id: string, patch: Partial<PosOrderSummary>) {
    setItems((current) =>
      current.map((order) =>
        order.id === id ? { ...order, ...patch } : order
      )
    );
  }

  async function run(
    orderId: string,
    action: () => Promise<{ ok: boolean; key?: string }>,
    onSuccess: (order: PosOrderSummary) => void
  ) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      const order = items.find((o) => o.id === orderId)!;
      onSuccess(order);
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={t("noData")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((order) => (
        <div
          key={order.id}
          className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-[var(--color-foreground)]">
                {order.orderNumber}
              </span>
              <Badge variant={statusVariant(order.status)}>
                {t(`status${order.status.charAt(0).toUpperCase() + order.status.slice(1)}` as "statusOpen")}
              </Badge>
            </div>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {order.tableNumber && `${t("table")}: ${order.tableNumber} · `}
              {t("items")}: {order.itemsCount} ·{" "}
              {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-[var(--color-primary)]">
              {formatCurrency(order.total)}
            </span>
            <div className="flex gap-2">
              {canConfirm && order.status === "open" && (
                <Button
                  size="sm"
                  loading={busy}
                  onClick={() =>
                    run(
                      order.id,
                      () => confirmPosOrderAction({ orderId: order.id }),
                      () => applyUpdate(order.id, { status: "confirmed" })
                    )
                  }
                >
                  {t("confirm")}
                </Button>
              )}
              {canCancel &&
                (order.status === "open" || order.status === "confirmed") && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busy}
                    onClick={() =>
                      run(
                        order.id,
                        () => cancelPosOrderAction({ orderId: order.id }),
                        () => applyUpdate(order.id, { status: "cancelled" })
                      )
                    }
                  >
                    {t("cancelShort")}
                  </Button>
                )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}