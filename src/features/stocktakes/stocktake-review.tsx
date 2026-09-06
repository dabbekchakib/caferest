"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, CheckCircle2, Flag } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import {
  Dialog,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/stores/use-toast-store";
import { formatMoney, formatDate } from "@/lib/purchases/format";
import type { StocktakeWithRelations } from "@/lib/stocktakes/types";
import type { StocktakeThresholds } from "@/lib/stocktakes/types";
import { varianceSeverity, summarizeStocktake } from "@/lib/stocktakes/calculations";
import {
  completeStocktakeAction,
  cancelStocktakeAction,
} from "@/features/stocktakes/actions";

export interface StocktakeReviewProps {
  stocktake: StocktakeWithRelations;
  thresholds: StocktakeThresholds;
  currency: string;
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "text-[var(--color-success)]"
      : tone === "danger"
        ? "text-[var(--color-danger)]"
        : "text-[var(--color-foreground)]";
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

export function StocktakeReview({
  stocktake,
  thresholds,
  currency,
}: StocktakeReviewProps) {
  const t = useTranslations("stocktakeReview");
  const tt = useTranslations("stocktakes");
  const tr = useTranslations("stocktakeVariance");
  const tValidation = useTranslations("stocktakeValidation");
  const tRoot = useTranslations();
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const summary = summarizeStocktake(stocktake.items);
  const isCounting = stocktake.status === "counting";
  const missingItems = stocktake.items.filter(
    (item) => item.counted_quantity === null
  ).length;

  async function runComplete() {
    setBusy(true);
    const resultAction = await completeStocktakeAction({
      stocktakeId: stocktake.id,
    });
    setBusy(false);
    if (resultAction.ok) {
      toast.success({ title: t("completed") });
      router.push(`/stocktakes/${stocktake.id}`);
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(resultAction.key ?? "authorization.errors.generic"),
      });
    }
  }

  async function runCancel() {
    setBusy(true);
    const resultAction = await cancelStocktakeAction({
      stocktakeId: stocktake.id,
      reason: reason || null,
    });
    setBusy(false);
    if (resultAction.ok) {
      toast.success({ title: t("cancelled") });
      setCancelOpen(false);
      router.push("/stocktakes");
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(resultAction.key ?? "authorization.errors.generic"),
      });
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={`${t("title")} · ${stocktake.stocktake_number}`}
        description={`${stocktake.locationName ?? ""} · ${formatDate(
          stocktake.started_at ?? stocktake.created_at
        )}`}
        breadcrumbs={[
          { label: tt("title"), href: "/stocktakes" },
          {
            label: stocktake.stocktake_number,
            href: `/stocktakes/${stocktake.id}`,
          },
          { label: t("title") },
        ]}
        actions={
          <Link href={`/stocktakes/${stocktake.id}`}>
            <Button variant="outline">
              <ArrowLeft className="size-4" aria-hidden /> {t("backToDetail")}
            </Button>
          </Link>
        }
      />

      {missingItems > 0 && (
        <Alert variant="warning" title={t("missingTitle")}>
          {t("missingDescription", { count: missingItems })}
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label={t("total")} value={String(summary.totalCount)} />
        <SummaryCard
          label={t("surplus")}
          value={formatMoney(summary.surplusValue, currency)}
          tone="success"
        />
        <SummaryCard
          label={t("missing")}
          value={formatMoney(summary.missingValue, currency)}
          tone="danger"
        />
        <SummaryCard
          label={t("net")}
          value={formatMoney(summary.netValue, currency)}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="divide-y divide-[var(--color-border)]">
          {stocktake.items.map((item) => {
            const counted = item.counted_quantity;
            const severity = counted === null ? null : varianceSeverity(
              item.variance_percentage,
              item.variance_value,
              thresholds
            );
            return (
              <div
                key={item.id}
                className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.ingredientName ?? item.ingredient_id}
                  </p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {item.ingredientSku ? `${item.ingredientSku} · ` : ""}
                    {t("expected")}:{" "}
                    {item.expected_quantity !== null
                      ? `${item.expected_quantity} ${item.baseUnitSymbol ?? ""}`
                      : "—"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <span className="text-sm">
                    {t("counted")}:{" "}
                    <span className="font-medium">
                      {counted !== null
                        ? `${counted} ${item.baseUnitSymbol ?? ""}`
                        : "—"}
                    </span>
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      (item.variance_quantity ?? 0) > 0
                        ? "text-[var(--color-success)]"
                        : (item.variance_quantity ?? 0) < 0
                          ? "text-[var(--color-danger)]"
                          : "text-[var(--color-muted-foreground)]"
                    }`}
                  >
                    {item.variance_quantity !== null
                      ? `${item.variance_quantity > 0 ? "+" : ""}${item.variance_quantity} ${item.baseUnitSymbol ?? ""}`
                      : "—"}
                  </span>
                  <span
                    className={`text-xs font-medium ${
                      item.variance_percentage !== null &&
                      Math.abs(item.variance_percentage) > 0
                        ? "text-[var(--color-muted-foreground)]"
                        : "text-[var(--color-muted-foreground)]"
                    }`}
                  >
                    {item.variance_percentage !== null
                      ? `${item.variance_percentage > 0 ? "+" : ""}${item.variance_percentage}%`
                      : ""}
                  </span>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {item.variance_value !== null
                      ? formatMoney(item.variance_value, currency)
                      : ""}
                  </span>
                  {severity && severity !== "none" && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold ${
                        severity === "approval"
                          ? "text-[var(--color-danger)]"
                          : "text-[var(--color-warning)]"
                      }`}
                    >
                      <Flag className="size-3" aria-hidden />
                      {tr(`severity.${severity}`)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setCancelOpen(true)}>
          {t("cancelStocktake")}
        </Button>
        {isCounting && (
          <Button
            onClick={runComplete}
            loading={busy}
            disabled={missingItems > 0}
          >
            <CheckCircle2 className="size-4" aria-hidden /> {t("complete")}
          </Button>
        )}
      </div>

      <Dialog
        open={cancelOpen}
        onOpenChange={(o) => !o && setCancelOpen(false)}
        title={tValidation("cancelTitle")}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              {tc("common.cancel")}
            </Button>
            <Button variant="danger" loading={busy} onClick={runCancel}>
              {tValidation("confirmCancel")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {tValidation("cancelDescription")}
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={tValidation("reasonPlaceholder")}
          />
        </div>
      </Dialog>
    </div>
  );
}