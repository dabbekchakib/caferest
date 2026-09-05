"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, FileDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney, formatDate } from "@/lib/purchases/format";
import {
  purchaseOrderStatusTone,
  PURCHASE_ORDER_STATUS_LABEL_KEYS,
} from "@/features/purchases/status-utils";
import type { PurchaseOrderWithRelations } from "@/lib/purchases/types";

export function PurchaseOrderPrint({
  order,
}: {
  order: PurchaseOrderWithRelations;
}) {
  const tp = useTranslations("purchaseOrderPrint");
  const tStatus = useTranslations("purchaseOrderStatus");
  const ti = useTranslations("purchaseOrderItems");
  const tt = useTranslations("purchaseOrderTotals");
  const td = useTranslations("purchaseOrderDetails");
  const tList = useTranslations("purchaseOrders");

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/purchase-orders/${order.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" aria-hidden /> {tp("back")}
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden /> {tp("print")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <FileDown className="size-4" aria-hidden /> {tp("downloadPdf")}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 print:rounded-none print:border-0 print:p-0">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border)] pb-6">
          <div>
            <h1 className="text-xl font-bold">{tp("title")}</h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {tList("title")} · {order.order_number}
            </p>
          </div>
          <StatusBadge
            status={purchaseOrderStatusTone(order.status)}
            label={tStatus(PURCHASE_ORDER_STATUS_LABEL_KEYS[order.status])}
            size="sm"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Meta label={tp("orderNumber")} value={order.order_number} />
          <Meta label={tp("supplier")} value={order.supplierName ?? "—"} />
          <Meta label={tp("orderDate")} value={formatDate(order.order_date)} />
          <Meta
            label={tp("expectedDate")}
            value={formatDate(order.expected_delivery_date)}
          />
          <Meta label={tp("status")} value={tStatus(PURCHASE_ORDER_STATUS_LABEL_KEYS[order.status])} />
          <Meta label={tp("currency")} value={order.currency_code} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  <th className="py-2 pr-3 font-medium">{ti("ingredient")}</th>
                  <th className="py-2 pr-3 font-medium">{ti("quantity")}</th>
                  <th className="py-2 pr-3 font-medium">{ti("unitPrice")}</th>
                  <th className="py-2 pr-3 font-medium">{ti("total")}</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-[var(--color-border)]"
                  >
                    <td className="py-2 pr-3">
                      <p className="font-medium">{item.description || item.ingredient_id}</p>
                      {item.supplier_sku && (
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                          {ti("sku")}: {item.supplier_sku}
                        </p>
                      )}
                      {item.tax_rate ? (
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                          {ti("taxRate")}: {item.tax_rate}%
                        </p>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">{item.quantity}</td>
                    <td className="py-2 pr-3">{formatMoney(item.unit_price, order.currency_code)}</td>
                    <td className="py-2 pr-3 font-medium">{formatMoney(item.total, order.currency_code)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              {tp("totals")}
            </h2>
            <dl className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm">
              <TotalRow label={tt("subtotal")} value={formatMoney(order.subtotal, order.currency_code)} />
              {order.discount_amount ? (
                <TotalRow label={tt("discount")} value={`-${formatMoney(order.discount_amount, order.currency_code)}`} />
              ) : null}
              <TotalRow label={tt("tax")} value={formatMoney(order.tax_amount, order.currency_code)} />
              <TotalRow label={tt("shipping")} value={formatMoney(order.shipping_amount, order.currency_code)} />
              {order.other_charges ? (
                <TotalRow label={tt("otherCharges")} value={formatMoney(order.other_charges, order.currency_code)} />
              ) : null}
              <TotalRow label={tt("grandTotal")} value={formatMoney(order.total, order.currency_code)} strong />
            </dl>
          </div>
        </div>

        {(order.shipping_address || order.billing_address) && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {order.shipping_address && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  {td("shippingAddress")}
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{order.shipping_address}</p>
              </div>
            )}
            {order.billing_address && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  {td("billingAddress")}
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm">{order.billing_address}</p>
              </div>
            )}
          </div>
        )}

        {order.supplier_notes && (
          <p className="mt-8 whitespace-pre-wrap text-sm text-[var(--color-muted-foreground)]">
            {td("supplierNotes")}: {order.supplier_notes}
          </p>
        )}
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className={strong ? "text-base font-semibold" : "font-medium"}>{value}</dd>
    </div>
  );
}