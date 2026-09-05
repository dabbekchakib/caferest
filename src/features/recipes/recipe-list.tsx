"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SearchBar } from "@/components/shared/search-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { Select } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecipeCard } from "./recipe-card";
import { RecipeStatusBadge, RecipeDefaultBadge } from "./recipe-badges";
import { resolveRecipeName } from "@/lib/recipes/translations";
import { formatRecipeCost } from "@/lib/recipes/format";
import type { RecipeListViewItem } from "@/lib/recipes/types";
import type { RecipeStatus } from "@/lib/recipes/types";

interface RecipeListProps {
  recipes: RecipeListViewItem[];
  costs: Record<string, number | null>;
  canCreate: boolean;
  canViewCost: boolean;
}

type StatusFilter = "all" | RecipeStatus;

const STATUS_ORDER: StatusFilter[] = ["all", "draft", "active", "inactive", "archived"];

function recipeNames(r: RecipeListViewItem): string[] {
  const names = [r.name];
  for (const locale of ["en", "ar"] as const) {
    const t = r.translations[locale]?.name;
    if (t) names.push(t);
  }
  return names;
}

export function RecipeList({ recipes, costs, canCreate, canViewCost }: RecipeListProps) {
  const t = useTranslations("recipes");
  const tn = useTranslations("navigation");
  const tr = useTranslations("recipeStatus");
  const ta = useTranslations("recipeActions");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [view, setView] = useState<"table" | "cards">("table");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return recipes
      .filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (!needle) return true;
        const haystack = recipeNames(r).concat([r.productName]).join(" ").toLowerCase();
        return haystack.includes(needle);
      })
      .sort((a, b) => a.sort_order - b.sort_order || a.version - b.version);
  }, [recipes, query, statusFilter]);

  const columns: Column<RecipeListViewItem>[] = [
    {
      key: "name",
      header: t("table.name"),
      accessor: (r) => resolveRecipeName(r.name, r.translations, locale),
      sortable: true,
      sortValue: (r) => resolveRecipeName(r.name, r.translations, locale),
    },
    {
      key: "product",
      header: t("table.product"),
      accessor: (r) => (
        <Link
          href={`/products/${r.product_id}`}
          className="text-[var(--color-primary)] hover:underline"
        >
          {r.productName}
        </Link>
      ),
      sortable: true,
      sortValue: (r) => r.productName,
      hideOnMobile: true,
    },
    {
      key: "version",
      header: t("table.version"),
      accessor: (r) => <Badge variant="muted" size="sm">v{r.version}</Badge>,
      sortable: true,
      sortValue: (r) => r.version,
    },
    {
      key: "status",
      header: t("table.status"),
      accessor: (r) => (
        <span className="inline-flex items-center gap-1.5">
          <RecipeStatusBadge status={r.status} />
          {r.is_default && <RecipeDefaultBadge />}
        </span>
      ),
      sortable: true,
      sortValue: (r) => String(r.status),
    },
    ...(canViewCost
      ? [
          {
            key: "cost",
            header: t("table.cost"),
            accessor: (r) => formatRecipeCost(costs[r.id] ?? null, locale),
          } as Column<RecipeListViewItem>,
        ]
      : []),
    {
      key: "actions",
      header: t("table.actions"),
      accessor: (r) => (
        <Link href={`/recipes/${r.id}`}>
          <Button variant="outline" size="sm">{ta("view")}</Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t("title")}
        description={t("breadcrumb")}
        breadcrumbs={[{ label: tn("recipes") }]}
        actions={
          canCreate ? (
            <Link href="/recipes/create">
              <Button>
                <Plus className="size-4" aria-hidden /> {t("createButton")}
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <SearchBar
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchPlaceholder")}
          />
        </div>
        <div className="flex items-center gap-2">
          <Select
            aria-label={tr("label")}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          >
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? tc("common.all") : tr(s)}
              </option>
            ))}
          </Select>
          <Tabs defaultValue="table" value={view} onValueChange={(v) => setView(v as "table" | "cards")}>
            <TabsList>
              <TabsTrigger value="table">{t("viewTable")}</TabsTrigger>
              <TabsTrigger value="cards">{t("viewCards")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t("noRecipes")}
          description={t("noResults")}
        />
      ) : view === "table" ? (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(r) => r.id}
          onRowClick={(r) => {
            router.push(`/recipes/${r.id}`);
          }}
          emptyState={
            <EmptyState title={t("noRecipes")} description={t("noResults")} />
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <RecipeCard key={r.id} recipe={r} cost={canViewCost ? costs[r.id] ?? null : null} />
          ))}
        </div>
      )}

      <p className="text-xs text-[var(--color-muted-foreground)]">
        {t("totalCount", { count: filtered.length })}
      </p>
    </div>
  );
}