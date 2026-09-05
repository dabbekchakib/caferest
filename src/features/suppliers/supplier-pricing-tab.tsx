"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/shared/data-table";
import type { SupplierPriceHistoryEntry } from "@/lib/suppliers/types";
import { formatCost } from "@/lib/ingredients/formatters";

export function SupplierPricingTab({ history }: { history: SupplierPriceHistoryEntry[] }) {
  const t = useTranslations("supplierPricing");
  const locale = useLocale();

  const date = (iso: string | null, fallback: string) =>
    iso ? new Date(iso).toLocaleDateString(locale, { dateStyle: "medium" }) : fallback;

  const columns: Column<SupplierPriceHistoryEntry>[] = [
    {
      key: "ingredient",
      header: t("columns.ingredient"),
      accessor: (row) => (
        <span className="truncate text-sm font-medium">{row.ingredientName ?? ""}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: "price",
      header: t("columns.price"),
      accessor: (row) => (
        <span className="text-sm font-medium">
          {`${formatCost(Number(row.purchase_price), locale)} ${row.currency_code}`}
        </span>
      ),
      sortable: true,
      sortValue: (row) => Number(row.purchase_price),
    },
    {
      key: "unit",
      header: t("columns.unit"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.purchaseUnitSymbol ?? "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "quantity",
      header: t("columns.quantity"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {formatCost(Number(row.purchase_quantity), locale)}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "validFrom",
      header: t("columns.validFrom"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {date(row.valid_from, "—")}
        </span>
      ),
      sortable: true,
      sortValue: (row) =>
        row.valid_from ? new Date(row.valid_from).getTime() : 0,
    },
    {
      key: "validUntil",
      header: t("columns.validUntil"),
      accessor: (row) =>
        row.valid_until ? (
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {date(row.valid_until, "—")}
          </span>
        ) : (
          <Badge variant="success" size="sm" dot>
            {t("open")}
          </Badge>
        ),
      hideOnMobile: true,
    },
    {
      key: "source",
      header: t("columns.source"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {t(`source.${row.source ?? "manual"}`)}
        </span>
      ),
      hideOnMobile: true,
    },
  ];

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-semibold">{t("title")}</h3>
      <p className="mb-4 text-xs text-[var(--color-muted-foreground)]">
        {t("historyHint")}
      </p>
      {history.length === 0 ? (
        <p className="py-6 text-sm text-[var(--color-muted-foreground)]">
          {t("noData")}
        </p>
      ) : (
        <DataTable columns={columns} data={history} rowKey={(row) => row.id} striped />
      )}
    </Card>
  );
}