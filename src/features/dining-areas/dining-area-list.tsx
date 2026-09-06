"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  LayoutDashboard,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SearchBar } from "@/components/shared/search-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/stores/use-toast-store";
import type { DiningAreaWithTranslations } from "@/lib/tables/types";
import { resolveDiningAreaName } from "@/lib/tables/translations";
import { diningAreaIcon } from "@/lib/tables/icons";
import {
  deleteDiningAreaAction,
  reorderDiningAreasAction,
  setDiningAreaStatusAction,
} from "@/features/dining-areas/actions";
import { useLocale } from "next-intl";

export interface DiningAreaListProps {
  areas: DiningAreaWithTranslations[];
  query: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canReorder: boolean;
}

export function DiningAreaList({
  areas,
  query,
  canCreate,
  canUpdate,
  canDelete,
  canReorder,
}: DiningAreaListProps) {
  const t = useTranslations("diningAreas");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();

  const [queryInput, setQueryInput] = useState(query);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const delay = setTimeout(() => {
      const params = new URLSearchParams();
      if (queryInput) params.set("q", queryInput);
      const qs = params.toString();
      router.push(qs ? `/dining-areas?${qs}` : "/dining-areas");
      router.refresh();
    }, 300);
    return () => clearTimeout(delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput]);

  const filtered = query.trim()
    ? areas.filter((a) => a.name.toLowerCase().includes(query.trim().toLowerCase()))
    : areas;

  async function run(
    action: () => Promise<{ ok: boolean; key?: string }>,
    successTitle: string
  ) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      toast.success({ title: successTitle });
      setDeleteTarget(null);
      router.push("/dining-areas");
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  async function moveArea(index: number, direction: -1 | 1) {
    if (!canReorder) return;
    const target = index + direction;
    if (target < 0 || target >= filtered.length) return;
    const next = [...filtered];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    await run(
      () =>
        reorderDiningAreasAction({
          orderedIds: next.map((a) => a.id),
        }),
      t("reordered")
    );
  }

  async function toggleActive(area: DiningAreaWithTranslations) {
    if (!canUpdate) return;
    await run(
      () =>
        setDiningAreaStatusAction({
          diningAreaId: area.id,
          isActive: !area.is_active,
        }),
      t("updated")
    );
  }

  const columns: Column<DiningAreaWithTranslations>[] = [
    {
      key: "order",
      header: "",
      accessor: (row) => {
        const index = filtered.findIndex((a) => a.id === row.id);
        if (index === -1) return null;
        return (
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              disabled={!canReorder || index === 0}
              onClick={() => void moveArea(index, -1)}
              className="inline-flex size-6 items-center justify-center rounded text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-30"
              aria-label={t("moveUp")}
            >
              <ArrowUp className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              disabled={!canReorder || index === filtered.length - 1}
              onClick={() => void moveArea(index, 1)}
              className="inline-flex size-6 items-center justify-center rounded text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] disabled:opacity-30"
              aria-label={t("moveDown")}
            >
              <ArrowDown className="size-3.5" aria-hidden />
            </button>
          </div>
        );
      },
      headerClassName: "w-12",
    },
    {
      key: "name",
      header: t("columns.name"),
      accessor: (row) => (
        <Link
          href={`/dining-areas/${row.id}/edit`}
          className="flex min-w-0 items-center gap-3"
        >
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
            style={{ backgroundColor: row.color ?? "#4f46e5" }}
            aria-hidden
          >
            {(() => {
              const Icon = diningAreaIcon(row.icon);
              return <Icon className="size-4" />;
            })()}
          </span>
          <span className="truncate text-sm font-medium">
            {resolveDiningAreaName(row, locale)}
          </span>
        </Link>
      ),
      sortable: true,
      sortValue: (row) => resolveDiningAreaName(row, locale),
    },
    {
      key: "slug",
      header: t("columns.slug"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.slug}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "orderValue",
      header: t("columns.order"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.sort_order}
        </span>
      ),
      hideOnMobile: true,
      sortable: true,
      sortValue: (row) => row.sort_order,
    },
    {
      key: "active",
      header: t("columns.active"),
      accessor: (row) => (
        <button
          type="button"
          disabled={!canUpdate}
          onClick={() => void toggleActive(row)}
          className={[
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
            row.is_active
              ? "border-transparent bg-[var(--color-success)]/15 text-[var(--color-success)]"
              : "border-[var(--color-border)] text-[var(--color-muted-foreground)]",
          ].join(" ")}
          aria-pressed={row.is_active}
        >
          {row.is_active ? t("active") : t("inactive")}
        </button>
      ),
    },
    {
      key: "actions",
      header: tc("common.actions"),
      accessor: (row) => (
        <div className="flex items-center gap-0.5">
          {canUpdate && (
            <Link
              href={`/dining-areas/${row.id}/edit`}
              className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              aria-label={t("edit")}
            >
              <Pencil className="size-4" aria-hidden />
            </Link>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeleteTarget(row.id)}
              className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-danger)]"
              aria-label={t("delete")}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t("title")}
        breadcrumbs={[{ label: tn("diningAreas") }]}
        actions={
          canCreate ? (
            <Link href="/dining-areas/create">
              <Button>
                <Plus className="size-4" aria-hidden /> {t("create")}
              </Button>
            </Link>
          ) : undefined
        }
      />

      {areas.length === 0 ? (
        <EmptyState
          icon={<LayoutDashboard className="size-7" aria-hidden />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            canCreate ? (
              <Link href="/dining-areas/create">
                <Button>
                  <Plus className="size-4" aria-hidden /> {t("createFirst")}
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
                value={queryInput}
                onChange={(e) => setQueryInput(e.target.value)}
                onClear={() => setQueryInput("")}
                placeholder={t("searchPlaceholder")}
                className="sm:max-w-sm"
              />
              <span className="text-sm text-[var(--color-muted-foreground)]">
                {filtered.length} {t("results")}
              </span>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={filtered}
            rowKey={(row) => row.id}
            striped
            emptyState={
              <div className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                {tc("common.noResults")}
              </div>
            }
          />
        </>
      )}

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t("deleteTitle")}
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
                  () =>
                    deleteDiningAreaAction({
                      diningAreaId: deleteTarget,
                    }),
                  t("deleted")
                )
              }
            >
              {t("confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t("deleteDescription")}
        </p>
      </Dialog>
    </div>
  );
}