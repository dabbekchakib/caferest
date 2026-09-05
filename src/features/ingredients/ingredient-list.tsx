"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  Pencil,
  Plus,
  Power,
  Settings2,
  Trash2,
  MoveRight,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SearchBar } from "@/components/shared/search-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/stores/use-toast-store";
import {
  deleteIngredientAction,
  reorderIngredientsAction,
  setIngredientStatusAction,
  updateIngredientCostAction,
} from "@/features/ingredients/actions";
import { IngredientCard } from "./ingredient-card";
import { IngredientImage } from "./ingredient-image";
import { IngredientTypeBadge } from "./ingredient-badges";
import { parseDecimal, formatCost } from "@/lib/ingredients/formatters";
import { resolveIngredientName } from "@/lib/ingredients/translations";
import type { IngredientWithTranslations } from "@/lib/ingredients/types";
import type { CategoryWithTranslations } from "@/lib/categories/types";
import { resolveCategoryName } from "@/lib/categories/translations";

const PAGE_SIZE = 10;

type TypeFilter =
  | "all"
  | "raw_material"
  | "semi_finished"
  | "packaged"
  | "consumable"
  | "other";

interface IngredientListProps {
  ingredients: IngredientWithTranslations[];
  categories: CategoryWithTranslations[];
  costPerBaseUnit: Record<string, number | null>;
  unitLabels: Record<string, string>;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canUpdateCost: boolean;
  canUpdateStatus: boolean;
  canReorder: boolean;
}

interface FieldTarget {
  ingredient: IngredientWithTranslations;
  field: "is_active" | "is_stock_tracked";
  enabled: boolean;
}

function byOrder(a: IngredientWithTranslations, b: IngredientWithTranslations) {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
}

function ingredientNames(i: IngredientWithTranslations): string[] {
  const names = [i.name];
  for (const locale of ["en", "ar"] as const) {
    const tName = i.translations[locale]?.name;
    if (tName) names.push(tName);
  }
  return names;
}

export function IngredientList({
  ingredients,
  categories,
  costPerBaseUnit,
  unitLabels,
  canCreate,
  canUpdate,
  canDelete,
  canUpdateCost,
  canUpdateStatus,
  canReorder,
}: IngredientListProps) {
  const t = useTranslations("ingredients");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [statusTarget, setStatusTarget] = useState<FieldTarget | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<IngredientWithTranslations | null>(null);
  const [costTarget, setCostTarget] =
    useState<IngredientWithTranslations | null>(null);
  const [costValue, setCostValue] = useState("");
  const [busy, setBusy] = useState(false);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ingredients
      .filter((i) => {
        if (categoryFilter !== "all") {
          if (categoryFilter === "none" && i.category_id !== null) return false;
          if (categoryFilter !== "none" && i.category_id !== categoryFilter)
            return false;
        }
        if (typeFilter !== "all" && i.ingredient_type !== typeFilter) return false;
        if (statusFilter === "active" && !i.is_active) return false;
        if (statusFilter === "inactive" && i.is_active) return false;
        if (stockFilter === "tracked" && !i.is_stock_tracked) return false;
        if (stockFilter === "untracked" && i.is_stock_tracked) return false;
        if (!q) return true;
        const hay = [
          ...ingredientNames(i),
          i.slug,
          i.sku ?? "",
          i.barcode ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort(byOrder);
  }, [
    ingredients,
    query,
    categoryFilter,
    typeFilter,
    statusFilter,
    stockFilter,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageIndex = Math.min(page, totalPages);
  const paged = filtered.slice((pageIndex - 1) * PAGE_SIZE, pageIndex * PAGE_SIZE);

  const hasFilters =
    query.trim() !== "" ||
    categoryFilter !== "all" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    stockFilter !== "all";

  function resetFilters() {
    setQuery("");
    setCategoryFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setStockFilter("all");
  }

  async function run(action: () => Promise<unknown>, successTitle: string) {
    setBusy(true);
    const result = (await action()) as { ok: boolean; key?: string };
    setBusy(false);
    if (result.ok) {
      toast.success({ title: successTitle });
      setStatusTarget(null);
      setDeleteTarget(null);
      setCostTarget(null);
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  function siblingIds(categoryId: string | null) {
    return ingredients
      .filter((i) => i.category_id === categoryId)
      .sort(byOrder)
      .map((i) => i.id);
  }

  function move(id: string, categoryId: string | null, direction: -1 | 1) {
    const ids = siblingIds(categoryId);
    const index = ids.indexOf(id);
    if (index === -1) return;
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    const next = ids.slice();
    next[index] = ids[target];
    next[target] = ids[index];
    void run(
      () => reorderIngredientsAction({ categoryId, orderedIds: next }),
      t("success.reordered")
    );
  }

  function categoryLabel(id: string | null): string | null {
    const category = id ? categoryMap.get(id) : undefined;
    if (!category) return null;
    return resolveCategoryName(category.name, category.translations, locale);
  }

  const resName = (i: IngredientWithTranslations) =>
    resolveIngredientName(i.name, i.translations, locale);

  const costOf = (i: IngredientWithTranslations) => costPerBaseUnit[i.id] ?? null;

  const actionsFor = (i: IngredientWithTranslations) => (
    <div className="flex items-center gap-0.5">
      {canReorder && siblingIds(i.category_id).length > 1 && !i.is_system && (
        <>
          <button
            type="button"
            aria-label={t("actions.moveUp")}
            disabled={siblingIds(i.category_id).indexOf(i.id) === 0}
            onClick={() => move(i.id, i.category_id, -1)}
            className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("actions.moveDown")}
            disabled={
              siblingIds(i.category_id).indexOf(i.id) ===
              siblingIds(i.category_id).length - 1
            }
            onClick={() => move(i.id, i.category_id, 1)}
            className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowDown className="size-4" aria-hidden />
          </button>
        </>
      )}
      {canUpdateStatus && !i.is_system && (
        <button
          type="button"
          onClick={() =>
            setStatusTarget({
              ingredient: i,
              field: "is_active",
              enabled: !i.is_active,
            })
          }
          className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          aria-label={t("actions.toggleStatus")}
        >
          <Power className="size-4" aria-hidden />
        </button>
      )}
      {canUpdateStatus && !i.is_system && (
        <button
          type="button"
          onClick={() =>
            setStatusTarget({
              ingredient: i,
              field: "is_stock_tracked",
              enabled: !i.is_stock_tracked,
            })
          }
          className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          aria-label={
            i.is_stock_tracked
              ? t("actions.stopTracking")
              : t("actions.trackStock")
          }
        >
          <MoveRight className="size-4" aria-hidden />
        </button>
      )}
      {canUpdateCost && !i.is_system && (
        <button
          type="button"
          onClick={() => {
            setCostValue(String(i.purchase_cost));
            setCostTarget(i);
          }}
          className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          aria-label={t("actions.changeCost")}
        >
          <Settings2 className="size-4" aria-hidden />
        </button>
      )}
      {canUpdate && !i.is_system && (
        <Link
          href={`/ingredients/${i.id}/edit`}
          className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          aria-label={t("actions.edit")}
        >
          <Pencil className="size-4" aria-hidden />
        </Link>
      )}
      {canDelete && !i.is_system && (
        <button
          type="button"
          onClick={() => setDeleteTarget(i)}
          className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-danger)]"
          aria-label={t("actions.delete")}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );

  const columns: Column<IngredientWithTranslations>[] = [
    {
      key: "ingredient",
      header: t("table.ingredient"),
      accessor: (i) => (
        <Link href={`/ingredients/${i.id}`} className="flex min-w-0 items-center gap-3">
          <IngredientImage src={i.image_url} alt={resName(i)} className="size-10" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{resName(i)}</span>
            <span className="block text-xs text-[var(--color-muted-foreground)]">
              {i.sku ?? i.barcode ?? i.slug}
            </span>
          </span>
        </Link>
      ),
      sortable: true,
      sortValue: (i) => resName(i),
    },
    {
      key: "category",
      header: t("table.category"),
      accessor: (i) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {categoryLabel(i.category_id) ?? "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "type",
      header: t("table.type"),
      accessor: (i) => <IngredientTypeBadge ingredient={i} />,
      hideOnMobile: true,
    },
    {
      key: "baseUnit",
      header: t("table.baseUnit"),
      accessor: (i) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {i.base_unit_id ? unitLabels[i.base_unit_id] ?? "—" : "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "costPerBaseUnit",
      header: t("table.costPerUnit"),
      accessor: (i) => {
        const cost = costOf(i);
        return (
          <span className="text-sm font-medium">
            {cost !== null ? `${formatCost(cost, locale)} TND` : "—"}
          </span>
        );
      },
      sortable: true,
      sortValue: (i) => costOf(i) ?? Number.POSITIVE_INFINITY,
      hideOnMobile: true,
    },
    {
      key: "waste",
      header: t("table.waste"),
      accessor: (i) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {`${i.waste_percentage} %`}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: t("table.status"),
      accessor: (i) => (
        <span className="inline-flex items-center gap-1.5">
          {i.is_active ? (
            <Badge variant="success" size="sm" dot>
              {t("badges.active")}
            </Badge>
          ) : (
            <Badge variant="danger" size="sm" dot>
              {t("badges.inactive")}
            </Badge>
          )}
          {i.is_stock_tracked ? (
            <Badge size="sm">{t("badges.stockTracked")}</Badge>
          ) : (
            <Badge variant="outline" size="sm">
              {t("badges.stockNotTracked")}
            </Badge>
          )}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("table.actions"),
      accessor: actionsFor,
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        breadcrumbs={[{ label: tn("ingredients") }]}
        actions={
          canCreate ? (
            <Link href="/ingredients/create">
              <Button>
                <Plus className="size-4" aria-hidden /> {t("createButton")}
              </Button>
            </Link>
          ) : undefined
        }
      />

      {ingredients.length === 0 ? (
        <EmptyState
          title={t("noIngredients")}
          action={
            canCreate ? (
              <Link href="/ingredients/create">
                <Button>
                  <Plus className="size-4" aria-hidden /> {t("createButton")}
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SearchBar
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClear={() => setQuery("")}
                placeholder={t("searchPlaceholder")}
                className="sm:max-w-sm"
              />
              <span className="text-sm text-[var(--color-muted-foreground)]">
                {t("totalCount", { count: filtered.length })}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label={t("filters.category")}
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="sm:w-44"
              >
                <option value="all">{t("filters.allCategories")}</option>
                <option value="none">{t("filters.noCategory")}</option>
                {categories
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {resolveCategoryName(c.name, c.translations, locale)}
                    </option>
                  ))}
              </Select>
              <Select
                aria-label={t("filters.type")}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="sm:w-44"
              >
                <option value="all">{t("filters.allTypes")}</option>
                {(["raw_material", "semi_finished", "packaged", "consumable", "other"] as const).map(
                  (type) => (
                    <option key={type} value={type}>
                      {t(`types.${type}`)}
                    </option>
                  )
                )}
              </Select>
              <Select
                aria-label={t("filters.status")}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="sm:w-36"
              >
                <option value="all">{t("filters.allStatuses")}</option>
                <option value="active">{t("filters.activeOnly")}</option>
                <option value="inactive">{t("filters.inactiveOnly")}</option>
              </Select>
              <Select
                aria-label={t("filters.stock")}
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value)}
                className="sm:w-40"
              >
                <option value="all">{t("filters.allTracking")}</option>
                <option value="tracked">{t("filters.trackedOnly")}</option>
                <option value="untracked">{t("filters.untrackedOnly")}</option>
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  {t("resetFilters")}
                </Button>
              )}
            </div>
          </div>

          <Tabs defaultValue="table">
            <TabsList>
              <TabsTrigger value="table">{t("viewTable")}</TabsTrigger>
              <TabsTrigger value="cards">{t("viewCards")}</TabsTrigger>
            </TabsList>
            <TabsContent value="table">
              <DataTable
                columns={columns}
                data={paged}
                rowKey={(i) => i.id}
                striped
                emptyState={
                  <div className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                    {t("noResults")}
                  </div>
                }
              />
            </TabsContent>
            <TabsContent value="cards">
              {paged.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--color-border)] p-10 text-center text-sm text-[var(--color-muted-foreground)]">
                  {t("noResults")}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {paged.map((i) => (
                    <IngredientCard
                      key={i.id}
                      ingredient={i}
                      categoryLabel={categoryLabel(i.category_id)}
                      costPerBaseUnit={costOf(i)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>

          {filtered.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={pageIndex === 1}
                onClick={() => setPage(pageIndex - 1)}
              >
                {t("pagePrevious")}
              </Button>
              <span className="text-sm text-[var(--color-muted-foreground)]">
                {t("pageInfo", { page: pageIndex, total: totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pageIndex === totalPages}
                onClick={() => setPage(pageIndex + 1)}
              >
                {t("pageNext")}
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog
        open={statusTarget !== null}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        title={
          statusTarget
            ? statusTarget.field === "is_active"
              ? statusTarget.enabled
                ? t("dialogs.activateTitle")
                : t("dialogs.deactivateTitle")
              : t("dialogs.stockTitle")
            : ""
        }
        description={
          statusTarget?.field === "is_stock_tracked"
            ? t("dialogs.stockDescription")
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant={
                statusTarget?.field === "is_active"
                  ? statusTarget.enabled
                    ? "success"
                    : "danger"
                  : "success"
              }
              loading={busy}
              onClick={() =>
                statusTarget &&
                void run(
                  () =>
                    setIngredientStatusAction({
                      ingredientId: statusTarget.ingredient.id,
                      field: statusTarget.field,
                      value: statusTarget.enabled,
                    }),
                  statusTarget.field === "is_active"
                    ? t("success.updated")
                    : t("success.stockTrackingChanged")
                )
              }
            >
              {t("dialogs.confirmStatus")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {statusTarget && resName(statusTarget.ingredient)}
        </p>
      </Dialog>

      <Dialog
        open={costTarget !== null}
        onOpenChange={(o) => {
          if (!o) setCostTarget(null);
        }}
        title={t("dialogs.costTitle")}
        description={t("dialogs.costDescription")}
        footer={
          <>
            <Button variant="outline" onClick={() => setCostTarget(null)}>
              {tc("common.cancel")}
            </Button>
            <Button
              loading={busy}
              onClick={() =>
                costTarget &&
                void run(
                  () =>
                    updateIngredientCostAction({
                      ingredientId: costTarget.id,
                      purchaseCost: parseDecimal(costValue) ?? 0,
                    }),
                  t("success.costChanged")
                )
              }
            >
              {tc("common.save")}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {costTarget && resName(costTarget)}
          </p>
          <Input
            inputMode="decimal"
            value={costValue}
            onChange={(e) => setCostValue(e.target.value)}
            aria-label={t("dialogs.costLabel")}
          />
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {costTarget && `${parseDecimal(costValue) ?? 0} TND`}
          </p>
        </div>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t("dialogs.deleteTitle")}
        description={t("dialogs.deleteDescription")}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                deleteTarget &&
                void run(
                  () => deleteIngredientAction({ ingredientId: deleteTarget.id }),
                  t("success.deleted")
                )
              }
            >
              {t("dialogs.deleteButton")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {deleteTarget && resName(deleteTarget)}
        </p>
      </Dialog>
    </div>
  );
}