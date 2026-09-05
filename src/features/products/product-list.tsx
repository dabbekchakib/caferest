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
  deleteProductAction,
  reorderProductsAction,
  setProductStatusAction,
  updateProductPriceAction,
} from "@/features/products/actions";
import { ProductCard } from "./product-card";
import { ProductImage } from "./product-image";
import { ProductTypeBadge } from "./product-badges";
import { formatCurrency } from "@/lib/format";
import { parseDecimal } from "@/lib/products/formatters";
import { resolveProductName } from "@/lib/products/translations";
import type { ProductWithTranslations } from "@/lib/products/types";
import type { CategoryWithTranslations } from "@/lib/categories/types";
import { resolveCategoryName } from "@/lib/categories/translations";

const PAGE_SIZE = 10;

type TypeFilter = "all" | "product" | "composite" | "service";

interface ProductListProps {
  products: ProductWithTranslations[];
  categories: CategoryWithTranslations[];
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canUpdatePrice: boolean;
  canUpdateStatus: boolean;
  canReorder: boolean;
}

interface FieldTarget {
  product: ProductWithTranslations;
  field: "is_active" | "is_available" | "is_pos_enabled";
  enabled: boolean;
}

function byOrder(a: ProductWithTranslations, b: ProductWithTranslations) {
  return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
}

function productNames(p: ProductWithTranslations): string[] {
  const names = [p.name];
  for (const locale of ["en", "ar"] as const) {
    const tName = p.translations[locale]?.name;
    if (tName) names.push(tName);
  }
  return names;
}

export function ProductList({
  products,
  categories,
  canCreate,
  canUpdate,
  canDelete,
  canUpdatePrice,
  canUpdateStatus,
  canReorder,
}: ProductListProps) {
  const t = useTranslations("products");
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
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [posFilter, setPosFilter] = useState("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [statusTarget, setStatusTarget] = useState<FieldTarget | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<ProductWithTranslations | null>(null);
  const [priceTarget, setPriceTarget] =
    useState<ProductWithTranslations | null>(null);
  const [priceValue, setPriceValue] = useState("");
  const [busy, setBusy] = useState(false);

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => {
        if (categoryFilter !== "all") {
          if (categoryFilter === "none" && p.category_id !== null) return false;
          if (categoryFilter !== "none" && p.category_id !== categoryFilter)
            return false;
        }
        if (typeFilter !== "all" && p.product_type !== typeFilter) return false;
        if (statusFilter === "active" && !p.is_active) return false;
        if (statusFilter === "inactive" && p.is_active) return false;
        if (availabilityFilter === "available" && !p.is_available) return false;
        if (availabilityFilter === "unavailable" && p.is_available) return false;
        if (posFilter === "pos" && !p.is_pos_enabled) return false;
        if (posFilter === "non-pos" && p.is_pos_enabled) return false;
        if (featuredOnly && !p.is_featured) return false;
        if (!q) return true;
        const hay = [
          ...productNames(p),
          p.slug,
          p.sku ?? "",
          p.barcode ?? "",
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .sort(byOrder);
  }, [
    products,
    query,
    categoryFilter,
    typeFilter,
    statusFilter,
    availabilityFilter,
    posFilter,
    featuredOnly,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageIndex = Math.min(page, totalPages);
  const paged = filtered.slice((pageIndex - 1) * PAGE_SIZE, pageIndex * PAGE_SIZE);

  const hasFilters =
    query.trim() !== "" ||
    categoryFilter !== "all" ||
    typeFilter !== "all" ||
    statusFilter !== "all" ||
    availabilityFilter !== "all" ||
    posFilter !== "all" ||
    featuredOnly;

  function resetFilters() {
    setQuery("");
    setCategoryFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setAvailabilityFilter("all");
    setPosFilter("all");
    setFeaturedOnly(false);
  }

  async function run(action: () => Promise<unknown>, successTitle: string) {
    setBusy(true);
    const result = (await action()) as { ok: boolean; key?: string };
    setBusy(false);
    if (result.ok) {
      toast.success({ title: successTitle });
      setStatusTarget(null);
      setDeleteTarget(null);
      setPriceTarget(null);
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  function siblingIds(categoryId: string | null) {
    return products
      .filter((p) => p.category_id === categoryId)
      .sort(byOrder)
      .map((p) => p.id);
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
      () => reorderProductsAction({ categoryId, orderedIds: next }),
      t("success.updated")
    );
  }

  function categoryLabel(id: string | null): string | null {
    const category = id ? categoryMap.get(id) : undefined;
    if (!category) return null;
    return resolveCategoryName(category.name, category.translations, locale);
  }

  const resName = (p: ProductWithTranslations) =>
    resolveProductName(p.name, p.translations, locale);

  const actionsFor = (p: ProductWithTranslations) => (
    <div className="flex items-center gap-0.5">
      {canReorder && siblingIds(p.category_id).length > 1 && !p.is_system && (
        <>
          <button
            type="button"
            aria-label={t("actions.moveUp")}
            disabled={siblingIds(p.category_id).indexOf(p.id) === 0}
            onClick={() => move(p.id, p.category_id, -1)}
            className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("actions.moveDown")}
            disabled={
              siblingIds(p.category_id).indexOf(p.id) ===
              siblingIds(p.category_id).length - 1
            }
            onClick={() => move(p.id, p.category_id, 1)}
            className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowDown className="size-4" aria-hidden />
          </button>
        </>
      )}
      {canUpdateStatus && !p.is_system && (
        <button
          type="button"
          onClick={() =>
            setStatusTarget({
              product: p,
              field: "is_active",
              enabled: !p.is_active,
            })
          }
          className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          aria-label={t("actions.toggleStatus")}
        >
          <Power className="size-4" aria-hidden />
        </button>
      )}
      {canUpdatePrice && !p.is_system && (
        <button
          type="button"
          onClick={() => {
            setPriceValue(String(p.price));
            setPriceTarget(p);
          }}
          className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          aria-label={t("actions.changePrice")}
        >
          <Settings2 className="size-4" aria-hidden />
        </button>
      )}
      {canUpdate && !p.is_system && (
        <Link
          href={`/products/${p.id}/edit`}
          className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
          aria-label={t("actions.edit")}
        >
          <Pencil className="size-4" aria-hidden />
        </Link>
      )}
      {canDelete && !p.is_system && (
        <button
          type="button"
          onClick={() => setDeleteTarget(p)}
          className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-danger)]"
          aria-label={t("actions.delete")}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );

  const columns: Column<ProductWithTranslations>[] = [
    {
      key: "product",
      header: t("table.product"),
      accessor: (p) => (
        <Link href={`/products/${p.id}`} className="flex min-w-0 items-center gap-3">
          <ProductImage src={p.image_url} alt={resName(p)} className="size-10" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{resName(p)}</span>
            <span className="block text-xs text-[var(--color-muted-foreground)]">
              {p.sku ?? p.barcode ?? p.slug}
            </span>
          </span>
        </Link>
      ),
      sortable: true,
      sortValue: (p) => resName(p),
    },
    {
      key: "category",
      header: t("table.category"),
      accessor: (p) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {categoryLabel(p.category_id) ?? "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "type",
      header: t("table.type"),
      accessor: (p) => <ProductTypeBadge product={p} />,
      hideOnMobile: true,
    },
    {
      key: "price",
      header: t("table.price"),
      accessor: (p) => <span className="text-sm font-medium">{formatCurrency(p.price)}</span>,
      sortable: true,
      sortValue: (p) => p.price,
    },
    {
      key: "availability",
      header: t("table.availability"),
      accessor: (p) =>
        p.is_available ? (
          <Badge variant="success" size="sm">
            {t("badges.available")}
          </Badge>
        ) : (
          <Badge variant="secondary" size="sm">
            {t("badges.unavailable")}
          </Badge>
        ),
      hideOnMobile: true,
    },
    {
      key: "pos",
      header: t("table.pos"),
      accessor: (p) =>
        p.is_pos_enabled ? (
          <Badge size="sm">{t("badges.posEnabled")}</Badge>
        ) : (
          <Badge variant="outline" size="sm">
            {t("badges.posDisabled")}
          </Badge>
        ),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: t("table.status"),
      accessor: (p) =>
        p.is_active ? (
          <Badge variant="success" size="sm" dot>
            {t("badges.active")}
          </Badge>
        ) : (
          <Badge variant="danger" size="sm" dot>
            {t("badges.inactive")}
          </Badge>
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
        breadcrumbs={[{ label: tn("products") }]}
        actions={
          canCreate ? (
            <Link href="/products/create">
              <Button>
                <Plus className="size-4" aria-hidden /> {t("createButton")}
              </Button>
            </Link>
          ) : undefined
        }
      />

      {products.length === 0 ? (
        <EmptyState
          title={t("noProducts")}
          action={
            canCreate ? (
              <Link href="/products/create">
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
                className="sm:w-36"
              >
                <option value="all">{t("filters.allTypes")}</option>
                <option value="product">{t("types.product")}</option>
                <option value="composite">{t("types.composite")}</option>
                <option value="service">{t("types.service")}</option>
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
                aria-label={t("filters.availability")}
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value)}
                className="sm:w-36"
              >
                <option value="all">{t("filters.allAvailability")}</option>
                <option value="available">{t("filters.availableOnly")}</option>
                <option value="unavailable">
                  {t("filters.unavailableOnly")}
                </option>
              </Select>
              <Select
                aria-label={t("filters.pos")}
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value)}
                className="sm:w-36"
              >
                <option value="all">{t("filters.allPos")}</option>
                <option value="pos">{t("filters.posEnabledOnly")}</option>
                <option value="non-pos">{t("filters.posDisabledOnly")}</option>
              </Select>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={featuredOnly}
                  onChange={(e) => setFeaturedOnly(e.target.checked)}
                  className="size-4 accent-[var(--color-primary)]"
                />
                {t("filters.featuredOnly")}
              </label>
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
                rowKey={(p) => p.id}
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
                  {paged.map((p) => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      categoryLabel={categoryLabel(p.category_id)}
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
            ? statusTarget.enabled
              ? t("dialogs.activateTitle")
              : t("dialogs.deactivateTitle")
            : ""
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant={statusTarget?.enabled ? "success" : "danger"}
              loading={busy}
              onClick={() =>
                statusTarget &&
                void run(
                  () =>
                    setProductStatusAction({
                      productId: statusTarget.product.id,
                      field: statusTarget.field,
                      value: statusTarget.enabled,
                    }),
                  t("success.updated")
                )
              }
            >
              {t("dialogs.confirmStatus")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {statusTarget && resName(statusTarget.product)}
        </p>
      </Dialog>

      <Dialog
        open={priceTarget !== null}
        onOpenChange={(o) => {
          if (!o) setPriceTarget(null);
        }}
        title={t("dialogs.priceTitle")}
        description={t("dialogs.priceDescription")}
        footer={
          <>
            <Button variant="outline" onClick={() => setPriceTarget(null)}>
              {tc("common.cancel")}
            </Button>
            <Button
              loading={busy}
              onClick={() =>
                priceTarget &&
                void run(
                  () =>
                    updateProductPriceAction({
                      productId: priceTarget.id,
                      price: Number(priceValue),
                    }),
                  t("success.priceChanged")
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
            {priceTarget && resName(priceTarget)}
          </p>
          <Input
            inputMode="decimal"
            value={priceValue}
            onChange={(e) => setPriceValue(e.target.value)}
            aria-label={t("form.priceLabel")}
          />
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {priceTarget && formatCurrency(parseDecimal(priceValue) ?? 0)}
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
                  () => deleteProductAction({ productId: deleteTarget.id }),
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