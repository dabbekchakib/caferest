"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/stores/use-toast-store";
import {
  confirmPosOrderAction,
  holdPosOrderAction,
  cancelPosOrderAction,
} from "../actions";
import { formatCurrency } from "@/lib/format";
import type { PosOrderSummary } from "@/lib/pos/types";

interface OpenOrdersPanelProps {
  orders: PosOrderSummary[];
}

function statusVariant(status: string): "warning" | "success" | "danger" | "muted" {
  if (status === "open") return "warning";
  if (status === "confirmed") return "success";
  if (status === "cancelled") return "danger";
  return "muted";
}

function statusKey(status: string): string {
  if (status === "confirmed") return "statusConfirmed";
  if (status === "cancelled") return "statusCancelled";
  return "statusOpen";
}

export function OpenOrdersPanel({ orders }: OpenOrdersPanelProps) {
  const t = useTranslations("orders");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const toast = useToast();
  const router = useRouter();
  const [busyIds, setBusyIds] = useState(new Set<string>());

  async function run(
    orderId: string,
    action: () => Promise<{ ok: boolean; key?: string }>,
    successTitle: string
  ) {
    setBusyIds((ids) => new Set(ids).add(orderId));
    const result = await action();
    setBusyIds((ids) => {
      const next = new Set(ids);
      next.delete(orderId);
      return next;
    });
    if (result.ok) {
      toast.success({ title: successTitle });
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  const openOrders = orders.filter(
    (order) => order.status === "open" || order.status === "confirmed"
  );

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
      <div className="border-b border-[var(--color-border)] p-4">
        <h2 className="font-semibold text-[var(--color-foreground)]">
          {t("openOrders")}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {openOrders.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
            {t("noData")}
          </p>
        ) : (
          <ul className="space-y-3">
            {openOrders.map((order) => (
              <li
                key={order.id}
                className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[var(--color-foreground)]">
                    {order.orderNumber}
                  </span>
                  <Badge variant={statusVariant(order.status)}>
                    {t(statusKey(order.status))}
                  </Badge>
                </div>
                {(order.tableNumber || order.customerName) && (
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {order.tableNumber && `${t("table")}: ${order.tableNumber}`}
                    {order.tableNumber && order.customerName && " · "}
                    {order.customerName}
                  </p>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[var(--color-primary)]">
                    {formatCurrency(order.total)}
                  </span>
                  <div className="flex gap-2">
                    {order.status === "open" && (
                      <Button
                        size="sm"
                        loading={busyIds.has(order.id)}
                        onClick={() =>
                          run(
                            order.id,
                            () => confirmPosOrderAction({ orderId: order.id }),
                            t("confirmedToast", { number: order.orderNumber })
                          )
                        }
                      >
                        {t("confirm")}
                      </Button>
                    )}
                    {order.status === "confirmed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        loading={busyIds.has(order.id)}
                        onClick={() =>
                          run(
                            order.id,
                            () => holdPosOrderAction({ orderId: order.id }),
                            t("heldToast", { number: order.orderNumber })
                          )
                        }
                      >
                        {t("hold")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busyIds.has(order.id)}
                      onClick={() =>
                        run(
                          order.id,
                          () => cancelPosOrderAction({ orderId: order.id }),
                          t("cancelled")
                        )
                      }
                    >
                      {t("cancelShort")}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}