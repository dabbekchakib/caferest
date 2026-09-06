"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney, formatDate } from "@/lib/purchases/format";
import {
  goodsReceiptStatusTone,
  GOODS_RECEIPT_STATUS_LABEL_KEYS,
} from "@/features/receiving/status-utils";
import type { GoodsReceiptWithRelations } from "@/lib/receiving/types";

export function GoodsReceiptPrint({
  receipt,
  currency,
}: {
  receipt: GoodsReceiptWithRelations;
  currency: string;
}) {
  const tp = useTranslations("receiptPrint");
  const tStatus = useTranslations("receiptStatus");
  const ti = useTranslations("receiptItems");
  const tt = useTranslations("receiptTotals");
  const tList = useTranslations("receipts");

  const money = (amount: number) =>
    formatMoney(amount, receipt.currencyCode ?? currency);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/receipts/${receipt.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4" aria-hidden /> {tList("title")}
          </Button>
        </Link>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> {tp("print")}
        </Button>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 print:rounded-none print:border-0 print:p-0">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-[var(--color-border)] pb-6">
          <div>
            <h1 className="text-xl font-bold">{tp("title")}</h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {tList("title")} · {receipt.receipt_number}
            </p>
          </div>
          <StatusBadge
            status={goodsReceiptStatusTone(receipt.status)}
            label={tStatus(GOODS_RECEIPT_STATUS_LABEL_KEYS[receipt.status])}
            size="sm"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Meta label={tp("number")} value={receipt.receipt_number} />
          <Meta label={tp("date")} value={formatDate(receipt.receipt_date)} />
          <Meta label={tp("supplier")} value={receipt.supplierName ?? "—"} />
          <Meta
            label={tp("purchaseOrder")}
            value={receipt.purchaseOrderNumber ?? "—"}
          />
          <Meta label={tp("location")} value={receipt.locationName ?? "—"} />
          <Meta
            label={tp("receivedBy")}
            value={receipt.receivedByName ?? "—"}
          />
          <Meta
            label={tp("validatedBy")}
            value={receipt.validatedByName ?? "—"}
          />
          {receipt.delivery_note_number && (
            <Meta label={tp("deliveryNote")} value={receipt.delivery_note_number} />
          )}
          {receipt.supplier_invoice_number && (
            <Meta
              label={tp("supplierInvoice")}
              value={receipt.supplier_invoice_number}
            />
          )}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                  <th className="py-2 pr-3 font-medium">{ti("ingredient")}</th>
                  <th className="py-2 pr-3 font-medium">{ti("ordered")}</th>
                  <th className="py-2 pr-3 font-medium">{ti("received")}</th>
                  <th className="py-2 pr-3 font-medium">{ti("accepted")}</th>
                  <th className="py-2 pr-3 font-medium">{ti("rejected")}</th>
                  <th className="py-2 pr-3 font-medium">{ti("unitPrice")}</th>
                  <th className="py-2 pr-3 font-medium">{ti("total")}</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--color-border)]">
                    <td className="py-2 pr-3">
                      <p className="font-medium">
                        {item.ingredientName ?? item.ingredient_id}
                      </p>
                      {item.purchaseUnitSymbol && (
                        <p className="text-xs text-[var(--color-muted-foreground)]">
                          {item.purchaseUnitSymbol}
                        </p>
                      )}
                    </td>
                    <td className="py-2 pr-3">{item.ordered_quantity}</td>
                    <td className="py-2 pr-3">{item.received_quantity}</td>
                    <td className="py-2 pr-3">{item.accepted_quantity}</td>
                    <td className="py-2 pr-3">{item.rejected_quantity}</td>
                    <td className="py-2 pr-3">{formatMoney(item.unit_price, receipt.currencyCode ?? currency)}</td>
                    <td className="py-2 pr-3 font-medium">{money(item.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <dl className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm">
              <TotalRow label={tt("subtotal")} value={money(receipt.subtotal)} />
              {receipt.discount_amount ? (
                <TotalRow
                  label={tt("discount")}
                  value={`-${money(receipt.discount_amount)}`}
                />
              ) : null}
              <TotalRow label={tt("tax")} value={money(receipt.tax_amount)} />
              <TotalRow
                label={tt("grandTotal")}
                value={money(receipt.total_amount)}
                strong
              />
            </dl>
          </div>
        </div>

        {receipt.notes && (
          <p className="mt-8 whitespace-pre-wrap text-sm text-[var(--color-muted-foreground)]">
            {receipt.notes}
          </p>
        )}

        <div className="mt-10 flex items-end justify-between gap-6">
          <p className="max-w-sm text-xs text-[var(--color-muted-foreground)]">
            {tp("notice")}
          </p>
          <div className="text-center">
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {tp("signedBy")}
            </p>
            <div className="mt-10 w-44 border-b border-[var(--color-border)]" />
          </div>
        </div>
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