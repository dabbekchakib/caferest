"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDate } from "@/lib/purchases/format";
import type { StockAdjustmentWithRelations } from "@/lib/stock-adjustments/types";
import {
  STOCK_ADJUSTMENT_STATUS_LABEL_KEYS,
} from "@/features/stock-adjustments/status-utils";

export interface StockAdjustmentPrintProps {
  adjustment: StockAdjustmentWithRelations;
  currency: string;
}

export function StockAdjustmentPrint({
  adjustment,
  currency,
}: StockAdjustmentPrintProps) {
  const t = useTranslations("stockAdjustmentPrint");
  const tStatus = useTranslations("stockAdjustmentStatus");
  const tTypes = useTranslations("stockAdjustmentTypes");
  const tItems = useTranslations("stockAdjustmentItems");
  const tc = useTranslations("common");

  return (
    <div className="p-4 sm:p-8 print:p-0">
      <div className="no-print mb-6 flex items-center gap-3">
        <Link href={`/stock-adjustments/${adjustment.id}`}>
          <Button variant="outline" size="sm">
            <ArrowLeft className="size-4" aria-hidden /> {tc("common.back")}
          </Button>
        </Link>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="size-4" aria-hidden /> {t("print")}
        </Button>
      </div>

      <div className="mx-auto max-w-3xl rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-8 print:max-w-none print:border-0">
        <div className="mb-6 border-b border-[var(--color-border)] pb-4 text-center">
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            {adjustment.adjustment_number}
          </p>
          <p className="mt-2 inline-flex items-center gap-2 text-sm">
            <span className="font-medium">
              {tStatus(
                STOCK_ADJUSTMENT_STATUS_LABEL_KEYS[adjustment.status]
              )}
            </span>
            <span aria-hidden>·</span>
            <span>{tTypes(adjustment.adjustment_type)}</span>
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <PrintInfo label={t("number")} value={adjustment.adjustment_number} />
          <PrintInfo
            label={t("type")}
            value={tTypes(adjustment.adjustment_type)}
          />
          <PrintInfo
            label={t("date")}
            value={formatDate(adjustment.adjustment_date)}
          />
          <PrintInfo
            label={t("location")}
            value={adjustment.locationName ?? "—"}
          />
          <PrintInfo label={t("reason")} value={adjustment.reasonLabel ?? "—"} />
          <PrintInfo
            label={t("internalReference")}
            value={adjustment.internal_reference ?? "—"}
          />
          <PrintInfo
            label={t("createdBy")}
            value={adjustment.createdByName ?? "—"}
          />
          <PrintInfo
            label={t("createdAt")}
            value={formatDate(adjustment.created_at)}
          />
          {adjustment.approved_by ? (
            <PrintInfo
              label={t("approvedBy")}
              value={adjustment.approvedByName ?? "—"}
            />
          ) : null}
        </div>

        {adjustment.notes ? (
          <div className="mt-6 rounded-lg bg-[var(--color-muted)]/40 p-4 text-sm">
            <p className="mb-1 font-medium">{t("notes")}</p>
            <p className="whitespace-pre-wrap text-[var(--color-muted-foreground)]">
              {adjustment.notes}
            </p>
          </div>
        ) : null}

        <div className="mt-8 overflow-hidden rounded-lg border border-[var(--color-border)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-muted)]/50">
                <tr className="text-left text-xs text-[var(--color-muted-foreground)]">
                  <th className="px-4 py-2 font-medium">{tItems("ingredient")}</th>
                  <th className="px-3 py-2 font-medium">{tItems("quantity")}</th>
                  <th className="px-3 py-2 font-medium">{tItems("unitCost")}</th>
                  <th className="px-4 py-2 text-right font-medium">
                    {tItems("lineValue")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {adjustment.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 font-medium">
                      {item.ingredientName ?? item.ingredient_id}
                    </td>
                    <td className="px-3 py-2">
                      {item.base_quantity} {item.baseUnitSymbol ?? ""}
                    </td>
                    <td className="px-3 py-2">
                      {formatMoney(item.unit_cost, currency)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatMoney(item.total_cost, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-[var(--color-muted)]/50">
                <tr className="text-xs text-[var(--color-muted-foreground)]">
                  <td className="px-4 py-2" colSpan={3}>
                    {t("totalQuantity")}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-[var(--color-foreground)]">
                    {adjustment.summary.totalQuantity}
                  </td>
                </tr>
                <tr className="font-semibold">
                  <td className="px-4 py-2" colSpan={3}>
                    {t("totalValue")}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {formatMoney(adjustment.summary.totalValue, currency)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-8 text-sm print:mt-16">
          <div className="space-y-1">
            <p className="font-medium">{t("signature")}</p>
            <p className="text-[var(--color-muted-foreground)]">
              {adjustment.approvedByName ?? "—"}
            </p>
            <div className="mt-10 border-b border-[var(--color-border)]" />
          </div>
          <div className="space-y-1">
            <p className="font-medium">{t("validatedBy")}</p>
            <p className="text-[var(--color-muted-foreground)]">
              {adjustment.validatedByName ?? "—"}
            </p>
            <div className="mt-10 border-b border-[var(--color-border)]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function PrintInfo({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}