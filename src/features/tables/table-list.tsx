"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Armchair, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SearchBar } from "@/components/shared/search-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/stores/use-toast-store";
import {
  DINING_TABLE_STATUSES,
  TABLE_STATUS_META,
  TABLE_STATUS_LABEL_KEYS,
  TABLE_SHAPE_LABEL_KEYS,
} from "@/lib/tables/status";
import type {
  DiningTablePageResult,
  DiningTableStatus,
} from "@/lib/tables/types";
import {
  deleteTableAction,
  duplicateTableAction,
  setTableStatusAction,
} from "@/features/tables/actions";

export interface TableListProps {
  result: DiningTablePageResult;
  query: string;
  status: "all" | DiningTableStatus;
  areaId: string;
  areas: Array<{ id: string; name: string }>;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canStatus: boolean;
}

export function TableList({
  result,
  query,
  status,
  areaId,
  areas,
  canCreate,
  canUpdate,
  canDelete,
  canStatus,
}: TableListProps) {
  const t = useTranslations("tables");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const router = useRouter();
  const toast = useToast();

  const [queryInput, setQueryInput] = useState(query);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const delay = setTimeout(() => {
      pushQuery({ q: queryInput || undefined, page: undefined });
    }, 300);
    return () => clearTimeout(delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryInput]);

  function pushQuery(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    if (updates.q ?? queryInput) params.set("q", updates.q ?? queryInput);
    if ((updates.status ?? status) !== "all")
      params.set("status", updates.status ?? status);
    if (updates.areaId ?? (areaId && areaId !== "all"))
      params.set("areaId", updates.areaId ?? areaId);
    if (updates.page) params.set("page", updates.page);
    const qs = params.toString();
    router.push(qs ? `/tables?${qs}` : "/tables");
    router.refresh();
  }

  function resetFilters() {
    setQueryInput("");
    pushQuery({
      q: undefined,
      status: "all",
      areaId: "all",
      page: undefined,
    });
  }

  async function run(
    action: () => Promise<{ ok: boolean; key?: string }>,
    successTitle: string
  ) {
    setBusy(true);
    const resultAction = await action();
    setBusy(false);
    if (resultAction.ok) {
      toast.success({ title: successTitle });
      setDeleteTarget(null);
      router.push("/tables");
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(resultAction.key ?? "authorization.errors.generic"),
      });
    }
  }

  function statusLabel(statusValue: DiningTableStatus) {
    return t(TABLE_STATUS_LABEL_KEYS[statusValue]);
  }

  const columns: Column<(typeof result.items)[0]>[] = [
    {
      key: "name",
      header: t("columns.name"),
      accessor: (row) =>
        canUpdate ? (
          <Link
            href={`/tables/${row.id}/edit`}
            className="flex min-w-0 items-center gap-3"
          >
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: row.color ?? "#4f46e5" }}
              aria-hidden
            >
              <Armchair className="size-4" />
            </span>
            <span className="truncate text-sm font-medium">{row.name}</span>
          </Link>
        ) : (
          <span className="flex min-w-0 items-center gap-3">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: row.color ?? "#4f46e5" }}
              aria-hidden
            >
              <Armchair className="size-4" />
            </span>
            <span className="truncate text-sm font-medium">{row.name}</span>
          </span>
        ),
      sortable: true,
      sortValue: (row) => row.name,
    },
    {
      key: "number",
      header: t("columns.number"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.table_number ?? "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "area",
      header: t("columns.area"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.areaName ?? "—"}
        </span>
      ),
      hideOnMobile: true,
      sortable: true,
      sortValue: (row) => row.areaName ?? "",
    },
    {
      key: "capacity",
      header: t("columns.capacity"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.capacity}
        </span>
      ),
      hideOnMobile: true,
      sortable: true,
      sortValue: (row) => row.capacity,
    },
    {
      key: "shape",
      header: t("columns.shape"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {t(TABLE_SHAPE_LABEL_KEYS[row.shape])}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: t("columns.status"),
      accessor: (row) =>
        canStatus ? (
          <Select
            aria-label={t("statusLabel")}
            value={row.status}
            onChange={(e) =>
              void run(
                () =>
                  setTableStatusAction({
                    tableId: row.id,
                    status: e.target.value as DiningTableStatus,
                  }),
                t("statusChanged")
              )
            }
            className="w-36"
          >
            {DINING_TABLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(TABLE_STATUS_LABEL_KEYS[s])}
              </option>
            ))}
          </Select>
        ) : (
          <StatusBadge
            status={TABLE_STATUS_META[row.status].badge}
            label={statusLabel(row.status)}
            size="sm"
          />
        ),
    },
    {
      key: "actions",
      header: tc("common.actions"),
      accessor: (row) => (
        <div className="flex items-center gap-0.5">
          {canCreate && (
            <button
              type="button"
              onClick={() =>
                void run(
                  () =>
                    duplicateTableAction({
                      tableId: row.id,
                    }),
                  t("duplicated")
                )
              }
              className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              aria-label={t("duplicate")}
              title={t("duplicate")}
            >
              <Plus className="size-4" aria-hidden />
            </button>
          )}
          {canUpdate && (
            <Link
              href={`/tables/${row.id}/edit`}
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

  const hasFilters =
    queryInput !== "" ||
    status !== "all" ||
    (areaId !== "" && areaId !== "all");

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t("title")}
        breadcrumbs={[{ label: tn("tables") }]}
        actions={
          canCreate ? (
            <Link href="/tables/create">
              <Button>
                <Plus className="size-4" aria-hidden /> {t("create")}
              </Button>
            </Link>
          ) : undefined
        }
      />

      {result.total === 0 && !hasFilters ? (
        <EmptyState
          icon={<Armchair className="size-7" aria-hidden />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            canCreate ? (
              <Link href="/tables/create">
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
                {result.total} {t("results")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label={t("filterStatus")}
                value={status}
                onChange={(e) =>
                  pushQuery({ status: e.target.value, page: undefined })
                }
                className="sm:w-48"
              >
                <option value="all">{t("filterAll")}</option>
                {DINING_TABLE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {t(TABLE_STATUS_LABEL_KEYS[s])}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={t("filterArea")}
                value={areaId && areaId !== "all" ? areaId : "all"}
                onChange={(e) =>
                  pushQuery({ areaId: e.target.value, page: undefined })
                }
                className="sm:w-52"
              >
                <option value="all">{t("filterAll")}</option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  {t("reset")}
                </Button>
              )}
            </div>
          </div>

          <DataTable
            columns={columns}
            data={result.items}
            rowKey={(row) => row.id}
            striped
            emptyState={
              <div className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                {tc("common.noResults")}
              </div>
            }
          />

          {result.totalPages > 1 && (
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={result.page <= 1}
                onClick={() => pushQuery({ page: String(result.page - 1) })}
              >
                {tc("common.previous")}
              </Button>
              <span className="text-sm text-[var(--color-muted-foreground)]">
                {tc("pagination.page", { page: result.page })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={result.page >= result.totalPages}
                onClick={() => pushQuery({ page: String(result.page + 1) })}
              >
                {tc("common.next")}
              </Button>
            </div>
          )}
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
                    deleteTableAction({
                      tableId: deleteTarget,
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