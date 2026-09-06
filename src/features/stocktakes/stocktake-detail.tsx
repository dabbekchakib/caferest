"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Flag,
  Play,
  Printer,
  Trash2,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/stores/use-toast-store";
import { formatMoney, formatDate } from "@/lib/purchases/format";
import type { StocktakeWithRelations } from "@/lib/stocktakes/types";
import type { StocktakeAction } from "@/lib/stocktakes/status";
import { STOCKTAKE_STATUS_ORDER } from "@/lib/stocktakes/status";
import { stocktakeAvailableActions } from "@/lib/stocktakes/status";
import { summarizeStocktake, varianceSeverity } from "@/lib/stocktakes/calculations";
import type { StocktakeThresholds } from "@/lib/stocktakes/types";
import {
  stocktakeStatusTone,
  STOCKTAKE_STATUS_LABEL_KEYS,
} from "@/features/stocktakes/status-utils";
import {
  approveStocktakeAction,
  validateStocktakeAction,
  cancelStocktakeAction,
  deleteStocktakeAction,
} from "@/features/stocktakes/actions";

export interface StocktakeDetailProps {
  stocktake: StocktakeWithRelations;
  movements: Array<{
    id: string;
    ingredientName: string | null;
    direction: "in" | "out";
    baseQuantity: number | null;
    baseUnitSymbol: string | null;
    unitCost: number;
    totalCost: number;
    createdAt: string;
  }>;
  thresholds: StocktakeThresholds;
  actionPermissions: Record<StocktakeAction, boolean>;
  currency: string;
}

const STEPS: StocktakeWithRelations["status"][] = [
  "draft",
  "counting",
  "pending_review",
  "approved",
  "validated",
];

export function StocktakeDetail({
  stocktake,
  movements,
  thresholds,
  actionPermissions,
  currency,
}: StocktakeDetailProps) {
  const tt = useTranslations("stocktakes");
  const tDetails = useTranslations("stocktakeDetails");
  const tStatus = useTranslations("stocktakeStatus");
  const tActions = useTranslations("stocktakeActions");
  const tValidation = useTranslations("stocktakeValidation");
  const tVariance = useTranslations("stocktakeVariance");
  const tHistory = useTranslations("stocktakeHistory");
  const tRoot = useTranslations();
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"approve" | "validate" | "cancel" | "delete" | null>(null);
  const [reason, setReason] = useState("");

  const summary = summarizeStocktake(stocktake.items);
  const available = stocktakeAvailableActions(stocktake.status);
  const can = (action: StocktakeAction) =>
    available.includes(action) && actionPermissions[action];

  async function run(action: () => Promise<{ ok: boolean; key?: string }>, successKey: string) {
    setBusy(true);
    const resultAction = await action();
    setBusy(false);
    if (resultAction.ok) {
      toast.success({ title: tActions(successKey) });
      setDialog(null);
      if (dialog === "delete") {
        router.push("/stocktakes");
      } else {
        router.refresh();
      }
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(resultAction.key ?? "authorization.errors.generic"),
      });
    }
  }

  function runApprove() {
    return run(
      () => approveStocktakeAction({ stocktakeId: stocktake.id }),
      "approved"
    );
  }

  function runValidate() {
    return run(
      () =>
        validateStocktakeAction({
          stocktakeId: stocktake.id,
          reason: reason || null,
        }),
      "validated"
    );
  }

  function runCancel() {
    return run(
      () =>
        cancelStocktakeAction({
          stocktakeId: stocktake.id,
          reason: reason || null,
        }),
      "cancelled"
    );
  }

  function runDelete() {
    return run(
      () => deleteStocktakeAction({ stocktakeId: stocktake.id }),
      "deleted"
    );
  }

  const currentStep = STOCKTAKE_STATUS_ORDER[stocktake.status];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={stocktake.stocktake_number}
        description={`${stocktake.locationName ?? tDetails("noLocation")} · ${tt(
          stocktake.mode === "blind" ? "modeBlind" : "modeStandard"
        )}`}
        breadcrumbs={[
          { label: tt("title"), href: "/stocktakes" },
          { label: stocktake.stocktake_number },
        ]}
        actions={
          <>
            <Link href={`/stocktakes/${stocktake.id}/print`}>
              <Button variant="outline">
                <Printer className="size-4" aria-hidden /> {tDetails("print")}
              </Button>
            </Link>
            <Link href={`/stocktakes/${stocktake.id}/count`}>
              <Button variant="outline">
                <Play className="size-4" aria-hidden /> {tDetails("openCount")}
              </Button>
            </Link>
            {stocktake.status !== "draft" && (
              <Link href={`/stocktakes/${stocktake.id}/review`}>
                <Button variant="outline">
                  <Eye className="size-4" aria-hidden /> {tDetails("openReview")}
                </Button>
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge
          status={stocktakeStatusTone(stocktake.status)}
          label={tStatus(STOCKTAKE_STATUS_LABEL_KEYS[stocktake.status])}
        />
        <div className="flex items-center gap-1">
          {STEPS.map((step, i) => {
            const done = currentStep > i;
            const active = currentStep === i;
            return (
              <div key={step} className="flex items-center gap-1">
                <span
                  className={`size-2 rounded-full ${
                    active
                      ? "bg-[var(--color-primary)]"
                      : done
                        ? "bg-[var(--color-success)]"
                        : "bg-[var(--color-muted-foreground)]/30"
                  }`}
                  aria-label={tStatus(STOCKTAKE_STATUS_LABEL_KEYS[step])}
                />
                {i < STEPS.length - 1 && (
                  <span className="h-px w-6 bg-[var(--color-border)]" />
                )}
              </div>
            );
          })}
        </div>
        {can("start") && (
          <Link href={`/stocktakes/${stocktake.id}/count`}>
            <Button size="sm">
              <Play className="size-4" aria-hidden /> {tDetails("start")}
            </Button>
          </Link>
        )}
        {can("complete") && (
          <Link href={`/stocktakes/${stocktake.id}/review`}>
            <Button size="sm">
              <ClipboardCheck className="size-4" aria-hidden />
              {tDetails("complete")}
            </Button>
          </Link>
        )}
        {can("approve") && (
          <Button size="sm" onClick={() => setDialog("approve")}>
            <CheckCircle2 className="size-4" aria-hidden /> {tDetails("approve")}
          </Button>
        )}
        {can("validate") && (
          <Button size="sm" onClick={() => setDialog("validate")}>
            <CheckCircle2 className="size-4" aria-hidden /> {tDetails("validate")}
          </Button>
        )}
        {can("cancel") && (
          <Button size="sm" variant="outline" onClick={() => setDialog("cancel")}>
            <XCircle className="size-4" aria-hidden /> {tDetails("cancel")}
          </Button>
        )}
        {can("delete") && (
          <Button size="sm" variant="danger" onClick={() => setDialog("delete")}>
            <Trash2 className="size-4" aria-hidden /> {tDetails("delete")}
          </Button>
        )}
      </div>

      {stocktake.status === "pending_review" && summary.varianceCount > 0 && (
        <Alert variant="warning" title={tDetails("pendingReviewTitle")}>
          {tDetails("pendingReviewDescription", { count: summary.varianceCount })}
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label={tDetails("totalLines")} value={String(summary.totalCount)} />
        <StatCard label={tDetails("counted")} value={String(summary.countedCount)} />
        <StatCard label={tDetails("pending")} value={String(summary.pendingCount)} />
        <StatCard
          label={tDetails("surplus")}
          value={formatMoney(summary.surplusValue, currency)}
          tone="success"
        />
        <StatCard
          label={tDetails("missing")}
          value={formatMoney(summary.missingValue, currency)}
          tone="danger"
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
                    {item.counted_at ? `${tDetails("countedAt")}: ${formatDate(item.counted_at)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span>
                    {tDetails("expected")}:{" "}
                    <span className="font-medium">
                      {item.expected_quantity !== null
                        ? `${item.expected_quantity} ${item.baseUnitSymbol ?? ""}`
                        : "—"}
                    </span>
                  </span>
                  <span>
                    {tDetails("counted")}:{" "}
                    <span className="font-medium">
                      {counted !== null
                        ? `${counted} ${item.baseUnitSymbol ?? ""}`
                        : "—"}
                    </span>
                  </span>
                  <span
                    className={`font-semibold ${
                      (item.variance_quantity ?? 0) > 0
                        ? "text-[var(--color-success)]"
                        : (item.variance_quantity ?? 0) < 0
                          ? "text-[var(--color-danger)]"
                          : "text-[var(--color-muted-foreground)]"
                    }`}
                  >
                    {item.variance_quantity !== null
                      ? `${item.variance_quantity > 0 ? "+" : ""}${item.variance_quantity}`
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
                      {tVariance(`severity.${severity}`)}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">{tHistory("title")}</h2>
          <ol className="space-y-3">
            {stocktake.history.map((entry) => (
              <li key={entry.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--color-primary)]" />
                <div>
                  <p className="font-medium">
                    {tStatus(
                      STOCKTAKE_STATUS_LABEL_KEYS[entry.to_status as keyof typeof STOCKTAKE_STATUS_LABEL_KEYS]
                    )}
                  </p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {formatDate(entry.created_at)}
                    {entry.reason ? ` · ${entry.reason}` : ""}
                  </p>
                </div>
              </li>
            ))}
            {stocktake.history.length === 0 && (
              <li className="text-sm text-[var(--color-muted-foreground)]">
                {tHistory("empty")}
              </li>
            )}
          </ol>
        </Card>

        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">{tDetails("movements")}</h2>
          {movements.length === 0 ? (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {tDetails("movementsEmpty")}
            </p>
          ) : (
            <div className="space-y-2">
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="min-w-0 truncate font-medium">
                    {m.ingredientName ?? m.id}
                  </span>
                  <span
                    className={`font-medium ${
                      m.direction === "out"
                        ? "text-[var(--color-danger)]"
                        : "text-[var(--color-success)]"
                    }`}
                  >
                    {m.direction === "out" ? "−" : "+"}
                    {m.baseQuantity} {m.baseUnitSymbol ?? ""}
                  </span>
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    {formatMoney(m.totalCost, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Dialog
        open={dialog !== null}
        onOpenChange={(o) => !o && setDialog(null)}
        title={
          dialog === "approve"
            ? tValidation("approveTitle")
            : dialog === "validate"
              ? tValidation("validateTitle")
              : dialog === "cancel"
                ? tValidation("cancelTitle")
                : tValidation("deleteTitle")
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant={
                dialog === "cancel" || dialog === "delete" ? "danger" : "primary"
              }
              loading={busy}
              onClick={() => {
                if (dialog === "approve") return runApprove();
                if (dialog === "validate") return runValidate();
                if (dialog === "cancel") return runCancel();
                if (dialog === "delete") return runDelete();
              }}
            >
              {tValidation("confirm")}
            </Button>
          </>
        }
      >
        {dialog === "approve" && (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {tValidation("approveDescription")}
          </p>
        )}
        {dialog === "validate" && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {tValidation("validateDescription")}
            </p>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder={tValidation("reasonPlaceholder")}
            />
          </div>
        )}
        {dialog === "cancel" && (
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
        )}
        {dialog === "delete" && (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {tValidation("deleteDescription")}
          </p>
        )}
      </Dialog>
    </div>
  );
}

function StatCard({
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