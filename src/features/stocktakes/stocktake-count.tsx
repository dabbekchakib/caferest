"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check, ClipboardList, Play } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/stores/use-toast-store";
import { formatMoney } from "@/lib/purchases/format";
import type { StocktakeWithRelations, CountFilter } from "@/lib/stocktakes/types";
import type { StocktakeScope } from "@/lib/stocktakes/types";
import { STOCKTAKE_SCOPES } from "@/lib/stocktakes/status";
import { varianceSeverity } from "@/lib/stocktakes/calculations";
import type { StocktakeThresholds } from "@/lib/stocktakes/types";
import {
  startStocktakeAction,
  updateStocktakeCountAction,
} from "@/features/stocktakes/actions";

export interface StocktakeCountProps {
  stocktake: StocktakeWithRelations;
  thresholds: StocktakeThresholds;
  frozen: boolean;
  ingredients: Array<{ id: string; name: string | null; sku: string | null }>;
  currency: string;
}

const COUNT_FILTERS: CountFilter[] = [
  "all",
  "pending",
  "counted",
  "variance",
  "reviewed",
];

export function StocktakeCount({
  stocktake,
  thresholds,
  frozen,
  ingredients,
  currency,
}: StocktakeCountProps) {
  const t = useTranslations("stocktakeCount");
  const td = useTranslations("stocktakeDetails");
  const tt = useTranslations("stocktakes");
  const tRoot = useTranslations();
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();

  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<StocktakeScope>("stocked");
  const [includeZeroStock, setIncludeZeroStock] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [ingredientQuery, setIngredientQuery] = useState("");
  const [filter, setFilter] = useState<CountFilter>("all");
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      stocktake.items.map((item) => [
        item.id,
        item.counted_quantity !== null
          ? String(item.counted_quantity)
          : "",
      ])
    )
  );
  const [saving, setSaving] = useState(false);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const allCounted =
    stocktake.items.length > 0 &&
    stocktake.items.every((item) => item.counted_quantity !== null);

  const filteredItems = useMemo(() => {
    const items = stocktake.items;
    if (filter === "all") return items;
    if (filter === "pending")
      return items.filter((item) => item.counted_quantity === null);
    if (filter === "counted")
      return items.filter((item) => item.counted_quantity !== null);
    if (filter === "variance")
      return items.filter((item) => item.variance_quantity !== 0);
    return items.filter(
      (item) =>
        item.counted_quantity !== null &&
        varianceSeverity(
          item.variance_percentage,
          item.variance_value,
          thresholds
        ) !== "none"
    );
  }, [stocktake.items, filter, thresholds]);

  const visibleIngredients = useMemo(() => {
    const query = ingredientQuery.trim().toLowerCase();
    const list = query
      ? ingredients.filter(
          (ingredient) =>
            (ingredient.name ?? "").toLowerCase().includes(query) ||
            (ingredient.sku ?? "").toLowerCase().includes(query)
        )
      : ingredients;
    return list.slice(0, 60);
  }, [ingredients, ingredientQuery]);

  function toggleIngredient(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleStart() {
    if (scope === "selected" && selectedIds.length === 0) {
      toast.error({ title: t("scopeSelectedEmpty") });
      return;
    }
    setBusy(true);
    const resultAction = await startStocktakeAction({
      stocktakeId: stocktake.id,
      scope,
      includeZeroStock,
      ingredientIds: scope === "selected" ? selectedIds : [],
    });
    setBusy(false);
    if (resultAction.ok) {
      toast.success({ title: t("started") });
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(resultAction.key ?? "authorization.errors.generic"),
      });
    }
  }

  async function saveCount(itemId: string, raw: string) {
    const value = raw.trim();
    const amount = value === "" ? null : Number(value);
    if (amount !== null && !Number.isFinite(amount)) return;
    setSaving(true);
    const resultAction = await updateStocktakeCountAction({
      stocktakeId: stocktake.id,
      itemId,
      amount,
      unitId: null,
    });
    setSaving(false);
    if (resultAction.ok) {
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(resultAction.key ?? "authorization.errors.generic"),
      });
    }
  }

  function onDraftChange(itemId: string, value: string) {
    const sanitized = value.replace(/[^0-9.,]/g, "");
    setDrafts((prev) => ({ ...prev, [itemId]: sanitized }));
    const existing = timers.current[itemId];
    if (existing) clearTimeout(existing);
    timers.current[itemId] = setTimeout(() => {
      void saveCount(itemId, sanitized);
    }, 800);
  }

  const isDraft = stocktake.status === "draft";
  const isCounting = stocktake.status === "counting";
  const countedLines = stocktake.items.filter(
    (item) => item.counted_quantity !== null
  ).length;
  const totalLines = stocktake.items.length;
  const progress = totalLines === 0 ? 0 : Math.round((countedLines / totalLines) * 100);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={stocktake.stocktake_number}
        description={`${stocktake.locationName ?? td("noLocation")} · ${tt(
          stocktake.mode === "blind" ? "modeBlind" : "modeStandard"
        )}`}
        breadcrumbs={[
          { label: tt("title"), href: "/stocktakes" },
          { label: stocktake.stocktake_number },
        ]}
        actions={
          <Link href={`/stocktakes/${stocktake.id}`}>
            <Button variant="outline">
              <ArrowLeft className="size-4" aria-hidden /> {t("backToDetail")}
            </Button>
          </Link>
        }
      />

      {frozen && (
        <Alert variant="warning" title={t("frozenTitle")}>
          {t("frozenDescription")}
        </Alert>
      )}

      {isDraft && (
        <Card className="p-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold">{t("startTitle")}</h2>
            <Field label={t("scope")} htmlFor="stocktake-scope">
              <Select
                id="stocktake-scope"
                value={scope}
                onChange={(e) => setScope(e.target.value as StocktakeScope)}
              >
                {STOCKTAKE_SCOPES.map((s) => (
                  <option key={s} value={s}>
                    {t(`scope.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeZeroStock}
                onChange={(e) => setIncludeZeroStock(e.target.checked)}
                className="size-4 accent-[var(--color-primary)]"
              />
              {t("includeZeroStock")}
            </label>

            {scope === "selected" && (
              <div className="space-y-2">
                <Input
                  type="search"
                  value={ingredientQuery}
                  onChange={(e) => setIngredientQuery(e.target.value)}
                  placeholder={t("ingredientSearch")}
                />
                <div className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-[var(--color-border)] p-2">
                  {visibleIngredients.map((ingredient) => (
                    <label
                      key={ingredient.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-[var(--color-muted)]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(ingredient.id)}
                        onChange={() => toggleIngredient(ingredient.id)}
                        className="size-4 accent-[var(--color-primary)]"
                      />
                      <span className="truncate">
                        {ingredient.name ?? ingredient.id}
                        {ingredient.sku ? ` (${ingredient.sku})` : ""}
                      </span>
                    </label>
                  ))}
                  {visibleIngredients.length === 0 && (
                    <p className="px-2 py-3 text-center text-sm text-[var(--color-muted-foreground)]">
                      {t("noIngredients")}
                    </p>
                  )}
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {selectedIds.length} {t("selectedCount")}
                </p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button onClick={handleStart} loading={busy}>
                <Play className="size-4" aria-hidden /> {t("startCounting")}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {isCounting && (
        <>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {COUNT_FILTERS.map((f) => (
                  <Button
                    key={f}
                    variant={filter === f ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setFilter(f)}
                  >
                    {t(`filter.${f}`)}
                  </Button>
                ))}
              </div>
              <span className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
                {saving ? (
                  <>
                    <ClipboardList className="size-4 animate-pulse" aria-hidden />
                    {t("saving")}
                  </>
                ) : (
                  <>
                    <Check className="size-4" aria-hidden />
                    {countedLines}/{totalLines} {t("counted")}
                  </>
                )}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {totalLines === 0 ? (
            <Card className="p-10 text-center text-sm text-[var(--color-muted-foreground)]">
              {t("noLines")}
            </Card>
          ) : (
            <div className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
              {filteredItems.map((item) => {
                const counted = item.counted_quantity;
                const severity = counted === null ? null : varianceSeverity(
                  item.variance_percentage,
                  item.variance_value,
                  thresholds
                );
                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {item.ingredientName ?? item.ingredient_id}
                      </p>
                      <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                        {item.ingredientSku
                          ? `${item.ingredientSku} · `
                          : ""}
                        {stocktake.mode === "blind"
                          ? t("blindTheoreticalHidden")
                          : item.expected_quantity !== null
                            ? `${t("expected")}: ${item.expected_quantity} ${item.baseUnitSymbol ?? ""}`
                            : t("expectedPending")}
                      </p>
                      {severity && severity !== "none" && counted !== null && (
                        <p
                          className={`text-xs font-medium ${
                            severity === "approval"
                              ? "text-[var(--color-danger)]"
                              : "text-[var(--color-warning)]"
                          }`}
                        >
                          {t(`severity.${severity}`)} · {item.variance_quantity}{" "}
                          {item.baseUnitSymbol ?? ""} ·{" "}
                          {formatMoney(item.variance_value ?? 0, currency)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[var(--color-muted-foreground)]">
                        {item.baseUnitSymbol ?? ""}
                      </span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={drafts[item.id] ?? ""}
                        onChange={(e) => onDraftChange(item.id, e.target.value)}
                        onBlur={() => {
                          const existing = timers.current[item.id];
                          if (existing) clearTimeout(existing);
                          void saveCount(item.id, drafts[item.id] ?? "");
                        }}
                        placeholder={t("countPlaceholder")}
                        className="w-32 text-right"
                        aria-label={`${item.ingredientName ?? item.ingredient_id}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {allCounted && (
            <div className="flex justify-end">
              <Link href={`/stocktakes/${stocktake.id}/review`}>
                <Button>
                  <Play className="size-4" aria-hidden /> {t("goToReview")}
                </Button>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}