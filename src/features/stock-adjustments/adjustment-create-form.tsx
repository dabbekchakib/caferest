"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2, TriangleAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/stores/use-toast-store";
import { formatMoney } from "@/lib/purchases/format";
import { STOCK_ADJUSTMENT_TYPES } from "@/lib/stock-adjustments/status";
import type { StockAdjustmentType } from "@/lib/stock-adjustments/types";
import {
  adjustmentRequiresApproval,
  stockAdjustmentTotals,
} from "@/lib/stock-adjustments/calculations";
import type { StockAdjustmentThresholds } from "@/lib/stock-adjustments/types";
import {
  getStockAdjustmentLocationsAction,
  getStockAdjustmentReasonsAction,
  getStockAdjustmentIngredientsAction,
  getStockQuantitiesAction,
  nextStockAdjustmentNumberAction,
  createStockAdjustmentAction,
} from "@/features/stock-adjustments/actions";

export interface StockAdjustmentCreateFormProps {
  thresholds: StockAdjustmentThresholds;
  currency: string;
}

interface DraftLine {
  key: string;
  ingredientId: string;
  ingredientName: string;
  ingredientSku: string;
  baseUnit: string;
  quantity: string;
  stock: number | null;
  cost: number | null;
}

let lineKeyCounter = 0;

export function StockAdjustmentCreateForm({
  thresholds,
  currency,
}: StockAdjustmentCreateFormProps) {
  const tf = useTranslations("stockAdjustmentForm");
  const tTypes = useTranslations("stockAdjustmentTypes");
  const tItems = useTranslations("stockAdjustmentItems");
  const tActions = useTranslations("stockAdjustmentActions");
  const tTotals = useTranslations("stockAdjustmentTotals");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const toast = useToast();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<
    Array<{ id: string; name: string; code: string }>
  >([]);
  const [reasons, setReasons] = useState<
    Array<{ id: string; code: string; label: string }>
  >([]);
  const [allIngredients, setAllIngredients] = useState<
    Array<{ id: string; name: string; sku: string; baseUnit: string }>
  >([]);
  const [numberPreview, setNumberPreview] = useState<string | null>(null);

  const [locationId, setLocationId] = useState("");
  const [type, setType] = useState<StockAdjustmentType>("loss");
  const [adjustmentDate, setAdjustmentDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [reasonId, setReasonId] = useState("");
  const [internalReference, setInternalReference] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [locData, reasonData, ingData, numData] = await Promise.all([
          getStockAdjustmentLocationsAction(),
          getStockAdjustmentReasonsAction(),
          getStockAdjustmentIngredientsAction(),
          nextStockAdjustmentNumberAction(),
        ]);
        if (cancelled) return;
        setLocations(locData);
        setReasons(reasonData);
        setAllIngredients(ingData);
        setNumberPreview(numData || null);
        if (locData.length > 0) setLocationId(locData[0].id);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadStocks = useCallback(
    async (locId: string, draftLines: DraftLine[]) => {
      const ids = draftLines.map((line) => line.ingredientId);
      if (!locId || ids.length === 0) return [];
      try {
        return await getStockQuantitiesAction({
          inventoryLocationId: locId,
          ingredientIds: ids,
        });
      } catch {
        // Availability is a preview — the RPC re-checks under lock at validate.
        return [];
      }
    },
    []
  );

  const applyStockData = useCallback(
    (
      data: Array<{ ingredientId: string; quantity: number; averageCost: number }>
    ) => {
      const map = new Map(
        data.map((row) => [
          row.ingredientId,
          { quantity: row.quantity, averageCost: row.averageCost },
        ])
      );
      setLines((prev) =>
        prev.map((line) => ({
          ...line,
          stock: map.get(line.ingredientId)?.quantity ?? 0,
          cost: map.get(line.ingredientId)?.averageCost ?? 0,
        }))
      );
    },
    []
  );

  useEffect(() => {
    void reloadStocks(locationId, lines).then(applyStockData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, applyStockData]);

  async function refreshReasons() {
    try {
      const data = await getStockAdjustmentReasonsAction({ type });
      setReasons(data);
    } catch {
      setReasons([]);
    }
  }

  const selectedIngredient = allIngredients.find((ing) => ing.id === ingredientId);

  function addLine() {
    if (!ingredientId) {
      setErrors((prev) => ({ ...prev, ingredient: tItems("ingredientRequired") }));
      return;
    }
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      setErrors((prev) => ({ ...prev, quantity: tItems("quantityRequired") }));
      return;
    }
    if (lines.some((line) => line.ingredientId === ingredientId)) {
      setErrors((prev) => ({ ...prev, ingredient: tItems("duplicateItem") }));
      return;
    }
    setErrors({});
    const ingredient = allIngredients.find((ing) => ing.id === ingredientId);
    const key = `line-${lineKeyCounter++}`;
    const newLine: DraftLine = {
      key,
      ingredientId,
      ingredientName: ingredient?.name ?? "",
      ingredientSku: ingredient?.sku ?? "",
      baseUnit: ingredient?.baseUnit ?? "",
      quantity: String(qty),
      stock: null,
      cost: null,
    };
    setLines((prev) => [...prev, newLine]);
    const nextLines = [...lines, newLine];
    setTimeout(
      () => void reloadStocks(locationId, nextLines).then(applyStockData),
      0
    );
    setIngredientId("");
    setQuantity("");
  }

  function removeLine(key: string) {
    const next = lines.filter((line) => line.key !== key);
    setLines(next);
    void reloadStocks(locationId, next).then(applyStockData);
  }

  const total = stockAdjustmentTotals(
    lines.map((line) => ({
      base_quantity: Number(line.quantity) || 0,
      unit_cost: line.cost ?? 0,
    }))
  );
  const requiresApproval = adjustmentRequiresApproval(thresholds, total.totalValue);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!locationId) {
      setErrors((prev) => ({ ...prev, locationId: tf("locationRequired") }));
      return;
    }
    if (lines.length === 0) {
      setErrors((prev) => ({ ...prev, lines: tItems("empty") }));
      return;
    }

    setBusy(true);
    const resultAction = await createStockAdjustmentAction({
      inventoryLocationId: locationId,
      adjustmentType: type,
      adjustmentDate,
      reasonId: reasonId || null,
      internalReference: internalReference || null,
      notes: notes || null,
      items: lines.map((line) => ({
        ingredientId: line.ingredientId,
        quantity: Number(line.quantity),
      })),
    });
    setBusy(false);

    if (resultAction.ok) {
      toast.success({ title: tActions("created") });
      router.push(`/stock-adjustments/${resultAction.data.id}`);
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(resultAction.key ?? "authorization.errors.generic"),
      });
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={tf("title")}
        breadcrumbs={[
          { label: tn("losses"), href: "/stock-adjustments" },
          { label: tf("title") },
        ]}
        actions={
          <Link href="/stock-adjustments">
            <Button variant="ghost" type="button">
              {tc("common.cancel")}
            </Button>
          </Link>
        }
      />

      <div className="mx-auto max-w-3xl space-y-6">
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-[var(--color-muted-foreground)]">
                {tf("numberPreview")}
              </span>
              <span className="font-medium">
                {loading ? "—" : (numberPreview ?? "—")}
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={tf("location")}
                htmlFor="adjustment-location"
                required
                error={errors.locationId}
              >
                <Select
                  id="adjustment-location"
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  disabled={loading || locations.length === 0}
                >
                  {locations.length === 0 ? (
                    <option value="">{tf("noLocations")}</option>
                  ) : (
                    locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                        {location.code ? ` (${location.code})` : ""}
                      </option>
                    ))
                  )}
                </Select>
              </Field>

              <Field label={tf("type")} htmlFor="adjustment-type" required>
                <Select
                  id="adjustment-type"
                  value={type}
                  onChange={(e) => {
                    const next = e.target.value as StockAdjustmentType;
                    setType(next);
                    setReasonId("");
                    void refreshReasons();
                  }}
                >
                  {STOCK_ADJUSTMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {tTypes(t)}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field
                label={tf("date")}
                htmlFor="adjustment-date"
                required
                error={errors.date}
              >
                <Input
                  id="adjustment-date"
                  type="date"
                  value={adjustmentDate}
                  onChange={(e) => setAdjustmentDate(e.target.value)}
                  required
                />
              </Field>

              <Field label={tf("reason")} htmlFor="adjustment-reason">
                <Select
                  id="adjustment-reason"
                  value={reasonId}
                  onChange={(e) => setReasonId(e.target.value)}
                  disabled={loading}
                >
                  <option value="">{tf("noReason")}</option>
                  {reasons.map((reason) => (
                    <option key={reason.id} value={reason.id}>
                      {reason.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={tf("internalReference")} htmlFor="adjustment-reference">
                <Input
                  id="adjustment-reference"
                  value={internalReference}
                  onChange={(e) => setInternalReference(e.target.value)}
                  placeholder={tf("referencePlaceholder")}
                />
              </Field>
            </div>

            <Field label={tf("notes")} htmlFor="adjustment-notes">
              <Textarea
                id="adjustment-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder={tf("notesPlaceholder")}
              />
            </Field>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold">{tItems("title")}</h2>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
            <Field
              label={tItems("ingredient")}
              htmlFor="line-ingredient"
              error={errors.ingredient}
            >
              <Select
                id="line-ingredient"
                value={ingredientId}
                onChange={(e) => setIngredientId(e.target.value)}
                disabled={loading || allIngredients.length === 0}
              >
                <option value="">{tItems("ingredientPlaceholder")}</option>
                {allIngredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name}
                    {ing.sku ? ` (${ing.sku})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label={`${tItems("quantity")}${
                selectedIngredient?.baseUnit
                  ? ` (${selectedIngredient.baseUnit})`
                  : ""
              }`}
              htmlFor="line-quantity"
              error={errors.quantity}
            >
              <Input
                id="line-quantity"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={tItems("quantityPlaceholder")}
              />
            </Field>
            <Button type="button" onClick={addLine} disabled={loading}>
              <Plus className="size-4" aria-hidden /> {tItems("add")}
            </Button>
          </div>

          {errors.lines && (
            <p className="mt-3 text-sm text-[var(--color-danger)]">
              {errors.lines}
            </p>
          )}

          {lines.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--color-muted-foreground)]">
              {tItems("emptyLines")}
            </p>
          ) : (
            <div className="mt-6 overflow-hidden rounded-lg border border-[var(--color-border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--color-muted)]/50">
                  <tr className="text-left text-xs text-[var(--color-muted-foreground)]">
                    <th className="px-3 py-2 font-medium">{tItems("ingredient")}</th>
                    <th className="px-3 py-2 font-medium">{tItems("quantity")}</th>
                    <th className="px-3 py-2 font-medium">{tItems("availability")}</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {lines.map((line) => {
                    const qty = Number(line.quantity) || 0;
                    const insufficient =
                      line.stock !== null && qty > line.stock;
                    return (
                      <tr key={line.key}>
                        <td className="px-3 py-2">
                          <p className="font-medium">{line.ingredientName}</p>
                          <p className="text-xs text-[var(--color-muted-foreground)]">
                            {line.ingredientSku}
                          </p>
                        </td>
                        <td className="px-3 py-2">
                          {line.quantity} {line.baseUnit}
                        </td>
                        <td className="px-3 py-2">
                          {line.stock === null ? (
                            "—"
                          ) : (
                            <span className={insufficient ? "text-[var(--color-danger)]" : ""}>
                              {line.stock} {line.baseUnit}
                              {insufficient && (
                                <TriangleAlert className="ms-1 inline size-3" aria-hidden />
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeLine(line.key)}
                            className="inline-flex size-8 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-danger)]"
                            aria-label={tItems("remove")}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 grid grid-cols-3 gap-3 rounded-lg bg-[var(--color-muted)]/40 p-4 text-sm">
            <div>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {tTotals("lines")}
              </p>
              <p className="mt-1 text-lg font-semibold">{total.itemCount}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {tTotals("totalQuantity")}
              </p>
              <p className="mt-1 text-lg font-semibold">{total.totalQuantity}</p>
            </div>
            <div>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {tTotals("totalValue")}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {formatMoney(total.totalValue, currency)}
              </p>
            </div>
          </div>

          {requiresApproval ? (
            <Alert variant="warning" title={tf("requiresApprovalTitle")}>
              {tf("requiresApprovalDescription")}
            </Alert>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Link href="/stock-adjustments">
            <Button type="button" variant="outline">
              {tc("common.cancel")}
            </Button>
          </Link>
          <Button type="submit" loading={busy} disabled={loading || locations.length === 0}>
            {tActions("create")}
          </Button>
        </div>
      </div>
    </form>
  );
}