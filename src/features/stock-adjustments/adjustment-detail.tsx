"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  Plus,
  Printer,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/stores/use-toast-store";
import { formatMoney, formatDate } from "@/lib/purchases/format";
import type { StockAdjustmentWithRelations } from "@/lib/stock-adjustments/types";
import type { StockAdjustmentStatus } from "@/lib/stock-adjustments/types";
import type { StockAdjustmentAction } from "@/lib/stock-adjustments/status";
import { STOCK_ADJUSTMENT_STATUS_ORDER } from "@/lib/stock-adjustments/status";
import { stockAdjustmentAvailableActions } from "@/lib/stock-adjustments/status";
import { isStockAdjustmentEditable } from "@/lib/stock-adjustments/status";
import { stockAdjustmentTotals, adjustmentRequiresApproval } from "@/lib/stock-adjustments/calculations";
import type { StockAdjustmentThresholds } from "@/lib/stock-adjustments/types";
import {
  stockAdjustmentStatusTone,
  STOCK_ADJUSTMENT_STATUS_LABEL_KEYS,
} from "@/features/stock-adjustments/status-utils";
import {
  approveStockAdjustmentAction,
  validateStockAdjustmentAction,
  cancelStockAdjustmentAction,
  deleteStockAdjustmentAction,
  submitStockAdjustmentAction,
  addStockAdjustmentItemAction,
} from "@/features/stock-adjustments/actions";

export interface StockAdjustmentDetailProps {
  adjustment: StockAdjustmentWithRelations;
  movements: Array<{
    id: string;
    ingredientName: string | null;
    baseQuantity: number | null;
    baseUnitSymbol: string | null;
    unitCost: number;
    totalCost: number;
    createdAt: string;
  }>;
  ingredients: Array<{ id: string; name: string; sku: string; baseUnit: string }>;
  thresholds: StockAdjustmentThresholds;
  actionPermissions: Record<StockAdjustmentAction, boolean>;
  canEdit: boolean;
  currency: string;
}

const STEPS: StockAdjustmentStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "validated",
];

export function StockAdjustmentDetail({
  adjustment,
  movements,
  ingredients,
  thresholds,
  actionPermissions,
  canEdit,
  currency,
}: StockAdjustmentDetailProps) {
  const tt = useTranslations("stockAdjustments");
  const tDetails = useTranslations("stockAdjustmentDetails");
  const tStatus = useTranslations("stockAdjustmentStatus");
  const tTypes = useTranslations("stockAdjustmentTypes");
  const tActions = useTranslations("stockAdjustmentActions");
  const tValidation = useTranslations("stockAdjustmentValidation");
  const tItems = useTranslations("stockAdjustmentItems");
  const tHistory = useTranslations("stockAdjustmentHistory");
  const tTotals = useTranslations("stockAdjustmentTotals");
  const tRoot = useTranslations();
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<
    "submit" | "approve" | "validate" | "cancel" | "delete" | null
  >(null);
  const [reason, setReason] = useState("");

  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");

  const summary = stockAdjustmentTotals(adjustment.items);
  const available = stockAdjustmentAvailableActions(adjustment.status);
  const editable = isStockAdjustmentEditable(adjustment.status) && canEdit;
  const can = (action: StockAdjustmentAction) =>
    available.includes(action) && actionPermissions[action];

  async function run(
    action: () => Promise<{ ok: boolean; key?: string }>,
    successKey: string
  ) {
    setBusy(true);
    const resultAction = await action();
    setBusy(false);
    if (resultAction.ok) {
      toast.success({ title: tActions(successKey) });
      setDialog(null);
      if (dialog === "delete") {
        router.push("/stock-adjustments");
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

  const selectedIngredient = ingredients.find((ing) => ing.id === ingredientId);

  async function addLine() {
    if (!ingredientId) {
      toast.error({ title: tItems("ingredientRequired") });
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error({ title: tItems("quantityRequired") });
      return;
    }
    if (adjustment.items.some((item) => item.ingredient_id === ingredientId)) {
      toast.error({ title: tItems("duplicateItem") });
      return;
    }
    setBusy(true);
    const resultAction = await addStockAdjustmentItemAction({
      adjustmentId: adjustment.id,
      ingredientId,
      quantity: qty,
    });
    setBusy(false);
    if (resultAction.ok) {
      toast.success({ title: tItems("lineAdded") });
      setIngredientId("");
      setQuantity("");
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(resultAction.key ?? "authorization.errors.generic"),
      });
    }
  }

  const currentStep = STOCK_ADJUSTMENT_STATUS_ORDER[adjustment.status];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={adjustment.adjustment_number}
        description={`${adjustment.locationName ?? tDetails("noLocation")} · ${tTypes(
          adjustment.adjustment_type
        )}`}
        breadcrumbs={[
          { label: tt("title"), href: "/stock-adjustments" },
          { label: adjustment.adjustment_number },
        ]}
        actions={
          <Link href={`/stock-adjustments/${adjustment.id}/print`}>
            <Button variant="outline">
              <Printer className="size-4" aria-hidden /> {tDetails("print")}
            </Button>
          </Link>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge
          status={stockAdjustmentStatusTone(adjustment.status)}
          label={tStatus(STOCK_ADJUSTMENT_STATUS_LABEL_KEYS[adjustment.status])}
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
                  aria-label={tStatus(STOCK_ADJUSTMENT_STATUS_LABEL_KEYS[step])}
                />
                {i < STEPS.length - 1 && (
                  <span className="h-px w-6 bg-[var(--color-border)]" />
                )}
              </div>
            );
          })}
        </div>
        {can("submit") && (
          <Button size="sm" onClick={() => setDialog("submit")}>
            <Send className="size-4" aria-hidden /> {tDetails("submit")}
          </Button>
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

      <Card className="p-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-4">
          <Info label={tDetails("number")} value={adjustment.adjustment_number} />
          <Info label={tDetails("type")} value={tTypes(adjustment.adjustment_type)} />
          <Info label={tDetails("date")} value={formatDate(adjustment.adjustment_date)} />
          <Info
            label={tDetails("location")}
            value={adjustment.locationName ?? "—"}
          />
          <Info
            label={tDetails("reason")}
            value={adjustment.reasonLabel ?? "—"}
          />
          <Info
            label={tDetails("internalReference")}
            value={adjustment.internal_reference ?? "—"}
          />
          <Info
            label={tDetails("createdBy")}
            value={adjustment.createdByName ?? "—"}
          />
          <Info
            label={tDetails("createdAt")}
            value={formatDate(adjustment.created_at)}
          />
          {adjustment.requires_approval && (
            <>
              <Info
                label={tDetails("submittedBy")}
                value={adjustment.submittedByName ?? "—"}
              />
              <Info
                label={tDetails("submittedAt")}
                value={adjustment.submitted_at ? formatDate(adjustment.submitted_at) : "—"}
              />
            </>
          )}
          {adjustment.approved_by && (
            <>
              <Info
                label={tDetails("approvedBy")}
                value={adjustment.approvedByName ?? "—"}
              />
              <Info
                label={tDetails("approvedAt")}
                value={adjustment.approved_at ? formatDate(adjustment.approved_at) : "—"}
              />
            </>
          )}
          {adjustment.validated_by && (
            <>
              <Info
                label={tDetails("validatedBy")}
                value={adjustment.validatedByName ?? "—"}
              />
              <Info
                label={tDetails("validatedAt")}
                value={adjustment.validated_at ? formatDate(adjustment.validated_at) : "—"}
              />
            </>
          )}
          {adjustment.cancelled_by && (
            <>
              <Info
                label={tDetails("cancelledBy")}
                value={adjustment.cancelledByName ?? "—"}
              />
              <Info
                label={tDetails("cancelledAt")}
                value={formatDate(adjustment.cancelled_at ?? "")}
              />
            </>
          )}
        </div>
        {adjustment.cancellation_reason ? (
          <div className="mt-4">
            <Info
              label={tDetails("cancellationReason")}
              value={adjustment.cancellation_reason}
            />
          </div>
        ) : null}
        {adjustment.notes ? (
          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <p className="mb-1 text-xs text-[var(--color-muted-foreground)]">
              {tDetails("notes")}
            </p>
            <p className="whitespace-pre-wrap text-sm">{adjustment.notes}</p>
          </div>
        ) : null}
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--color-border)] px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{tItems("title")}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <StatChip
                label={tTotals("lines")}
                value={String(summary.itemCount)}
              />
              <StatChip
                label={tTotals("totalQuantity")}
                value={`${summary.totalQuantity}`}
              />
              <StatChip
                label={tTotals("totalValue")}
                value={formatMoney(summary.totalValue, currency)}
              />
            </div>
          </div>
        </div>

        {adjustment.items.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-muted-foreground)]">
            {tItems("emptyLines")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-muted)]/50">
                <tr className="text-left text-xs text-[var(--color-muted-foreground)]">
                  <th className="px-6 py-2 font-medium">{tItems("ingredient")}</th>
                  <th className="px-3 py-2 font-medium">{tItems("quantity")}</th>
                  <th className="px-3 py-2 font-medium">{tItems("unitCost")}</th>
                  <th className="px-3 py-2 text-right font-medium">
                    {tItems("lineValue")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {adjustment.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-2">
                      <p className="font-medium">
                        {item.ingredientName ?? item.ingredient_id}
                      </p>
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {item.ingredientSku}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      {item.base_quantity} {item.baseUnitSymbol ?? ""}
                    </td>
                    <td className="px-3 py-2">
                      {formatMoney(item.unit_cost, currency)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {formatMoney(item.total_cost, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editable && (
          <div className="flex flex-col gap-3 border-t border-[var(--color-border)] p-6 sm:flex-row sm:items-end">
            <div className="flex-1">
              <FieldLabel htmlFor="detail-ingredient">
                {tItems("ingredient")}
              </FieldLabel>
              <Select
                id="detail-ingredient"
                value={ingredientId}
                onChange={(e) => setIngredientId(e.target.value)}
              >
                <option value="">{tItems("ingredientPlaceholder")}</option>
                {ingredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name}
                    {ing.sku ? ` (${ing.sku})` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:w-40">
              <FieldLabel htmlFor="detail-quantity">
                {tItems("quantity")}
                {selectedIngredient?.baseUnit
                  ? ` (${selectedIngredient.baseUnit})`
                  : ""}
              </FieldLabel>
              <Input
                id="detail-quantity"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={tItems("quantityPlaceholder")}
              />
            </div>
            <Button type="button" onClick={addLine} loading={busy}>
              <Plus className="size-4" aria-hidden /> {tItems("add")}
            </Button>
          </div>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-6">
          <h2 className="mb-3 text-base font-semibold">{tHistory("title")}</h2>
          <ol className="space-y-3">
            {adjustment.history.map((entry) => (
              <li key={entry.id} className="flex gap-3 text-sm">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--color-primary)]" />
                <div>
                  <p className="font-medium">
                    {tStatus(
                      STOCK_ADJUSTMENT_STATUS_LABEL_KEYS[
                        entry.to_status as keyof typeof STOCK_ADJUSTMENT_STATUS_LABEL_KEYS
                      ]
                    )}
                  </p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {formatDate(entry.created_at)}
                    {entry.reason ? ` · ${entry.reason}` : ""}
                  </p>
                </div>
              </li>
            ))}
            {adjustment.history.length === 0 && (
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
                  <span className="font-medium text-[var(--color-danger)]">
                    −{m.baseQuantity} {m.baseUnitSymbol ?? ""}
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
          dialog === "submit"
            ? tValidation("submitTitle")
            : dialog === "approve"
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
                if (dialog === "submit")
                  return run(
                    () =>
                      submitStockAdjustmentAction({
                        adjustmentId: adjustment.id,
                      }),
                    "submitted"
                  );
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
        {dialog === "submit" && (
          <div className="space-y-3">
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {tValidation("submitDescription")}
            </p>
            {adjustmentRequiresApproval(
              thresholds,
              summary.totalValue
            ) ? (
              <p className="text-sm font-medium text-[var(--color-warning)]">
                {tValidation("willRequireApproval")}
              </p>
            ) : (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {tValidation("autoApproved")}
              </p>
            )}
          </div>
        )}
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

  function runApprove() {
    return run(
      () => approveStockAdjustmentAction({ adjustmentId: adjustment.id }),
      "approved"
    );
  }

  function runValidate() {
    return run(
      () =>
        validateStockAdjustmentAction({
          adjustmentId: adjustment.id,
          reason: reason || null,
        }),
      "validated"
    );
  }

  function runCancel() {
    return run(
      () =>
        cancelStockAdjustmentAction({
          adjustmentId: adjustment.id,
          reason: reason || null,
        }),
      "cancelled"
    );
  }

  function runDelete() {
    return run(
      () => deleteStockAdjustmentAction({ adjustmentId: adjustment.id }),
      "deleted"
    );
  }
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--color-muted)]/40 px-3 py-1 text-sm">
      <span className="me-1 text-xs text-[var(--color-muted-foreground)]">
        {label}
      </span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: import("react").ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-sm font-medium"
    >
      {children}
    </label>
  );
}