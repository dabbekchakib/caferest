"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatMoney, formatDate } from "@/lib/purchases/format";
import { summarizeStocktake } from "@/lib/stocktakes/calculations";
import type { StocktakeWithRelations } from "@/lib/stocktakes/types";
import {
  stocktakeStatusTone,
  STOCKTAKE_STATUS_LABEL_KEYS,
} from "@/features/stocktakes/status-utils";

export function StocktakePrint({
  stocktake,
  currency,
}: {
  stocktake: StocktakeWithRelations;
  currency: string;
}) {
  const tp = useTranslations("stocktakePrint");
  const tStatus = useTranslations("stocktakeStatus");
  const tList = useTranslations("stocktakes");

  const summary = summarizeStocktake(stocktake.items);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/stocktakes/${stocktake.id}`}>
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
              {tList("title")} · {stocktake.stocktake_number}
            </p>
          </div>
          <StatusBadge
            status={stocktakeStatusTone(stocktake.status)}
            label={tStatus(STOCKTAKE_STATUS_LABEL_KEYS[stocktake.status])}
            size="sm"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Meta label={tp("number")} value={stocktake.stocktake_number} />
          <Meta label={tp("createdAt")} value={formatDate(stocktake.created_at)} />
          <Meta label={tp("location")} value={stocktake.locationName ?? "—"} />
          <Meta
            label={tp("mode")}
            value={tList(
              stocktake.mode === "blind" ? "modeBlind" : "modeStandard"
            )}
          />
          <Meta label={tp("startedAt")} value={formatDate(stocktake.started_at)} />
          <Meta
            label={tp("startedBy")}
            value={stocktake.startedByName ?? "—"}
          />
          <Meta
            label={tp("validatedAt")}
            value={formatDate(stocktake.validated_at)}
          />
          <Meta
            label={tp("validatedBy")}
            value={stocktake.validatedByName ?? "—"}
          />
          <Meta label={tp("netValue")} value={formatMoney(summary.netValue, currency)} />
        </div>

        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                <th className="py-2 pr-3 font-medium">{tp("ingredient")}</th>
                <th className="py-2 pr-3 font-medium">{tp("expected")}</th>
                <th className="py-2 pr-3 font-medium">{tp("counted")}</th>
                <th className="py-2 pr-3 font-medium">{tp("variance")}</th>
                <th className="py-2 pr-3 font-medium">{tp("value")}</th>
              </tr>
            </thead>
            <tbody>
              {stocktake.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-[var(--color-border)]"
                >
                  <td className="py-2 pr-3">
                    <p className="font-medium">
                      {item.ingredientName ?? item.ingredient_id}
                    </p>
                    {item.baseUnitSymbol && (
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {item.baseUnitSymbol}
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-3">
                    {item.expected_quantity ?? "—"}
                  </td>
                  <td className="py-2 pr-3">
                    {item.counted_quantity ?? "—"}
                  </td>
                  <td
                    className={`py-2 pr-3 ${
                      (item.variance_quantity ?? 0) > 0
                        ? "text-[var(--color-success)]"
                        : (item.variance_quantity ?? 0) < 0
                          ? "text-[var(--color-danger)]"
                          : ""
                    }`}
                  >
                    {item.variance_quantity !== null
                      ? `${item.variance_quantity > 0 ? "+" : ""}${item.variance_quantity}`
                      : "—"}
                  </td>
                  <td className="py-2 pr-3 font-medium">
                    {item.variance_value !== null
                      ? formatMoney(item.variance_value, currency)
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {stocktake.notes && (
          <div className="mt-6 text-sm">
            <p className="font-medium">{tp("notes")}</p>
            <p className="mt-1 text-[var(--color-muted-foreground)]">
              {stocktake.notes}
            </p>
          </div>
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