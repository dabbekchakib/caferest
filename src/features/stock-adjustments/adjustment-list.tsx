"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PackageOpen, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SearchBar } from "@/components/shared/search-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/stores/use-toast-store";
import { formatDate } from "@/lib/purchases/format";
import {
  STOCK_ADJUSTMENT_STATUSES,
  STOCK_ADJUSTMENT_TYPES,
} from "@/lib/stock-adjustments/status";
import type {
  StockAdjustmentPageResult,
  StockAdjustmentStatus,
  StockAdjustmentType,
} from "@/lib/stock-adjustments/types";
import {
  stockAdjustmentStatusTone,
  STOCK_ADJUSTMENT_STATUS_LABEL_KEYS,
} from "@/features/stock-adjustments/status-utils";
import { deleteStockAdjustmentAction } from "@/features/stock-adjustments/actions";

export interface StockAdjustmentListProps {
  result: StockAdjustmentPageResult;
  query: string;
  status: "all" | StockAdjustmentStatus;
  type: "all" | StockAdjustmentType;
  locationId: string;
  locations: Array<{ id: string; name: string; code: string | null }>;
  canCreate: boolean;
  canDelete: boolean;
}

export function StockAdjustmentList({
  result,
  query,
  status,
  type,
  locationId,
  locations,
  canCreate,
  canDelete,
}: StockAdjustmentListProps) {
  const tt = useTranslations("stockAdjustments");
  const tf = useTranslations("stockAdjustmentFilters");
  const tStatus = useTranslations("stockAdjustmentStatus");
  const tTypes = useTranslations("stockAdjustmentTypes");
  const td = useTranslations("stockAdjustmentDetails");
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
    if ((updates.type ?? type) !== "all")
      params.set("type", updates.type ?? type);
    if (updates.locationId ?? (locationId && locationId !== "all"))
      params.set("locationId", updates.locationId ?? locationId);
    if (updates.page) params.set("page", updates.page);
    const qs = params.toString();
    router.push(qs ? `/stock-adjustments?${qs}` : "/stock-adjustments");
    router.refresh();
  }

  function resetFilters() {
    setQueryInput("");
    pushQuery({
      q: undefined,
      status: "all",
      type: "all",
      locationId: undefined,
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
      router.push("/stock-adjustments");
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(resultAction.key ?? "authorization.errors.generic"),
      });
    }
  }

  const columns: Column<(typeof result.items)[0]>[] = [
    {
      key: "number",
      header: tt("columns.number"),
      accessor: (row) => (
        <Link href={`/stock-adjustments/${row.id}`} className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {row.adjustment_number}
          </span>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {formatDate(row.adjustment_date)}
          </span>
        </Link>
      ),
      sortable: true,
      sortValue: (row) => row.adjustment_number,
    },
    {
      key: "type",
      header: tt("columns.type"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {tTypes(row.adjustment_type)}
        </span>
      ),
    },
    {
      key: "location",
      header: tt("columns.location"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.locationName ?? "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: tt("columns.status"),
      accessor: (row) => (
        <StatusBadge
          status={stockAdjustmentStatusTone(row.status)}
          label={tStatus(STOCK_ADJUSTMENT_STATUS_LABEL_KEYS[row.status])}
          size="sm"
        />
      ),
    },
    {
      key: "lines",
      header: tt("columns.lines"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.totalLines}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "createdBy",
      header: tt("columns.createdBy"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.createdByName ?? "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: tc("common.actions"),
      accessor: (row) => (
        <div className="flex items-center gap-0.5">
          {canDelete && row.status === "draft" && (
            <button
              type="button"
              onClick={() => setDeleteTarget(row.id)}
              className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-danger)]"
              aria-label={tt("delete")}
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
    type !== "all" ||
    (locationId !== "" && locationId !== "all");

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={tt("title")}
        breadcrumbs={[{ label: tt("title") }]}
        actions={
          canCreate ? (
            <Link href="/stock-adjustments/create">
              <Button>
                <Plus className="size-4" aria-hidden /> {tt("newAdjustment")}
              </Button>
            </Link>
          ) : undefined
        }
      />

      {result.total === 0 && !hasFilters ? (
        <EmptyState
          icon={<PackageOpen className="size-7" aria-hidden />}
          title={tt("emptyTitle")}
          description={tt("emptyDescription")}
          action={
            canCreate ? (
              <Link href="/stock-adjustments/create">
                <Button>
                  <Plus className="size-4" aria-hidden /> {tt("createFirst")}
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
                placeholder={tt("searchPlaceholder")}
                className="sm:max-w-sm"
              />
              <span className="text-sm text-[var(--color-muted-foreground)]">
                {result.total} {tt("results")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label={tf("status")}
                value={status}
                onChange={(e) =>
                  pushQuery({ status: e.target.value, page: undefined })
                }
                className="sm:w-48"
              >
                <option value="all">{tf("statusAll")}</option>
                {STOCK_ADJUSTMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {tStatus(STOCK_ADJUSTMENT_STATUS_LABEL_KEYS[s])}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={tf("type")}
                value={type}
                onChange={(e) =>
                  pushQuery({ type: e.target.value, page: undefined })
                }
                className="sm:w-52"
              >
                <option value="all">{tf("typeAll")}</option>
                {STOCK_ADJUSTMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {tTypes(t)}
                  </option>
                ))}
              </Select>
              <Select
                aria-label={tf("location")}
                value={locationId && locationId !== "all" ? locationId : "all"}
                onChange={(e) =>
                  pushQuery({ locationId: e.target.value, page: undefined })
                }
                className="sm:w-52"
              >
                <option value="all">{tf("locationAll")}</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  {tf("reset")}
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
        title={td("deleteTitle")}
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
                    deleteStockAdjustmentAction({
                      adjustmentId: deleteTarget,
                    }),
                  td("deleted")
                )
              }
            >
              {td("confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {td("deleteDescription")}
        </p>
      </Dialog>
    </div>
  );
}