"use client";

import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCost } from "@/lib/ingredients/formatters";
import type { SupplierComparisonEntry } from "@/lib/suppliers/types";

interface SupplierComparisonTabProps {
  comparison: SupplierComparisonEntry[];
  currentSupplierId: string;
}

export function SupplierComparisonTab({
  comparison,
  currentSupplierId,
}: SupplierComparisonTabProps) {
  const t = useTranslations("supplierComparison");
  const locale = useLocale();

  if (comparison.length === 0 || !comparison.some((entry) => entry.offers.length > 0)) {
    return (
      <Card className="p-5">
        <h3 className="mb-1 text-sm font-semibold">{t("title")}</h3>
        <p className="mb-4 text-xs text-[var(--color-muted-foreground)]">
          {t("normalizedHint")}
        </p>
        <p className="py-6 text-sm text-[var(--color-muted-foreground)]">
          {t("noData")}
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-semibold">{t("title")}</h3>
      <p className="mb-4 text-xs text-[var(--color-muted-foreground)]">
        {t("subtitle")}
      </p>
      <div className="space-y-6">
        {comparison.map((entry) => (
          <div key={entry.ingredientId}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">{entry.ingredientName}</h4>
              {entry.baseUnitSymbol && (
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {t("perUnit", {})} {entry.baseUnitSymbol}
                </span>
              )}
            </div>
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                    <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {t("columns.supplier")}
                    </th>
                    <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {t("columns.price")}
                    </th>
                    <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {t("columns.perUnit")}
                    </th>
                    <th className="px-4 py-2.5 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {t("columns.normalizedCost")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entry.offers.map((offer) => {
                    const lowest =
                      entry.offers.filter(
                        (candidate) => candidate.normalizedCost?.amount != null
                      ).length > 0 &&
                      offer.normalizedCost != null &&
                      offer.normalizedCost.amount ===
                        Math.min(
                          ...entry.offers
                            .map((candidate) => candidate.normalizedCost?.amount)
                            .filter((amount): amount is number => amount != null)
                        );
                    const isCurrent = offer.supplierId === currentSupplierId;
                    return (
                      <tr
                        key={offer.supplierId}
                        className="border-b border-[var(--color-border)] last:border-0"
                      >
                        <td className="px-4 py-2.5">
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <span className="font-medium">{offer.supplierName}</span>
                            {offer.supplierCode && (
                              <span className="text-xs text-[var(--color-muted-foreground)]">
                                {offer.supplierCode}
                              </span>
                            )}
                            {isCurrent && (
                              <Badge variant="outline" size="sm">
                                {t("currentSupplier")}
                              </Badge>
                            )}
                            {offer.isPreferred && (
                              <Badge size="sm">{t("bestBadge")}</Badge>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-muted-foreground)]">
                          {`${formatCost(offer.purchasePrice, locale)} ${offer.currencyCode}`}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--color-muted-foreground)]">
                          {`${formatCost(offer.purchaseQuantity, locale)} ${offer.purchaseUnitSymbol ?? ""}`.trim()}
                        </td>
                        <td className="px-4 py-2.5">
                          {offer.normalizedCost ? (
                            <span
                              className={
                                lowest
                                  ? "inline-flex items-center gap-1.5 font-semibold text-[var(--color-success)]"
                                  : "text-[var(--color-muted-foreground)]"
                              }
                            >
                              {`${formatCost(offer.normalizedCost.amount, locale)} ${offer.currencyCode}`}
                              {lowest && (
                                <Badge variant="success" size="sm">
                                  {t("bestDeal")}
                                </Badge>
                              )}
                            </span>
                          ) : (
                            <span className="text-[var(--color-muted-foreground)]">
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {entry.offers.every((offer) => offer.normalizedCost == null) && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-2.5 text-xs text-[var(--color-muted-foreground)]"
                      >
                        {t("same")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}