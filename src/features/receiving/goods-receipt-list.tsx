"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PackageCheck, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SearchBar } from "@/components/shared/search-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/stores/use-toast-store";
import { formatMoney, formatDate } from "@/lib/purchases/format";
import {
  GOODS_RECEIPT_STATUSES,
  isReceiptEditable,
} from "@/lib/receiving/status";
import type { GoodsReceiptStatus } from "@/lib/receiving/types";
import type { GoodsReceiptPageResult } from "@/lib/receiving/types";
import {
  goodsReceiptStatusTone,
  GOODS_RECEIPT_STATUS_LABEL_KEYS,
} from "@/features/receiving/status-utils";
import { deleteGoodsReceiptAction } from "@/features/receiving/actions";

export interface GoodsReceiptListProps {
  result: GoodsReceiptPageResult;
  query: string;
  status: "all" | GoodsReceiptStatus;
  fromDate: string;
  toDate: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  currency: string;
}

export function GoodsReceiptList({
  result,
  query,
  status,
  fromDate,
  toDate,
  canCreate,
  canUpdate,
  canDelete,
  currency,
}: GoodsReceiptListProps) {
  const t = useTranslations("receipts");
  const tf = useTranslations("receiptFilters");
  const tActions = useTranslations("receiptActions");
  const tStatus = useTranslations("receiptStatus");
  const td = useTranslations("receiptDetails");
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
    if (updates.fromDate ?? fromDate) params.set("from", updates.fromDate ?? fromDate);
    if (updates.toDate ?? toDate) params.set("to", updates.toDate ?? toDate);
    if (updates.page) params.set("page", updates.page);
    const qs = params.toString();
    router.push(qs ? `/receipts?${qs}` : "/receipts");
    router.refresh();
  }

  function resetFilters() {
    setQueryInput("");
    pushQuery({
      q: undefined,
      status: "all",
      fromDate: undefined,
      toDate: undefined,
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
      router.push("/receipts");
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
      header: t("columns.number"),
      accessor: (row) => (
        <Link href={`/receipts/${row.id}`} className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{row.receipt_number}</span>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {formatDate(row.receipt_date)}
          </span>
        </Link>
      ),
      sortable: true,
      sortValue: (row) => row.receipt_number,
    },
    {
      key: "supplier",
      header: t("columns.supplier"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.supplierName ?? "—"}
          {row.supplierCode ? ` (${row.supplierCode})` : ""}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "purchaseOrder",
      header: t("columns.purchaseOrder"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.purchaseOrderNumber ?? "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "location",
      header: t("columns.location"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.locationName ?? "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: t("columns.status"),
      accessor: (row) => (
        <StatusBadge
          status={goodsReceiptStatusTone(row.status)}
          label={tStatus(GOODS_RECEIPT_STATUS_LABEL_KEYS[row.status])}
          size="sm"
        />
      ),
    },
    {
      key: "total",
      header: t("columns.total"),
      accessor: (row) => (
        <span className="text-sm font-medium">
          {formatMoney(row.total_amount, row.currencyCode ?? currency)}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "actions",
      header: tc("common.actions"),
      accessor: (row) => (
        <div className="flex items-center gap-0.5">
          {canUpdate && isReceiptEditable(row.status) && (
            <Link
              href={`/receipts/${row.id}/edit`}
              className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              aria-label={tActions("edit")}
            >
              <Pencil className="size-4" aria-hidden />
            </Link>
          )}
          {canDelete && row.status === "draft" && (
            <button
              type="button"
              onClick={() => setDeleteTarget(row.id)}
              className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-danger)]"
              aria-label={tActions("delete")}
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      ),
    },
  ];

  const hasFilters =
    queryInput !== "" || status !== "all" || fromDate !== "" || toDate !== "";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t("title")}
        breadcrumbs={[{ label: t("title") }]}
        actions={
          canCreate ? (
            <Link href="/receipts/create">
              <Button>
                <Plus className="size-4" aria-hidden /> {t("newReceipt")}
              </Button>
            </Link>
          ) : undefined
        }
      />

      {result.total === 0 && !hasFilters ? (
        <EmptyState
          icon={<PackageCheck className="size-7" aria-hidden />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            canCreate ? (
              <Link href="/receipts/create">
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
                aria-label={tStatus("draft")}
                value={status}
                onChange={(e) =>
                  pushQuery({ status: e.target.value, page: undefined })
                }
                className="sm:w-52"
              >
                <option value="all">{tf("statusAll")}</option>
                {GOODS_RECEIPT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {tStatus(GOODS_RECEIPT_STATUS_LABEL_KEYS[s])}
                  </option>
                ))}
              </Select>
              <Input
                type="date"
                aria-label={tf("fromDate")}
                value={fromDate}
                onChange={(e) => pushQuery({ fromDate: e.target.value, page: undefined })}
                className="sm:w-40"
              />
              <Input
                type="date"
                aria-label={tf("toDate")}
                value={toDate}
                onChange={(e) => pushQuery({ toDate: e.target.value, page: undefined })}
                className="sm:w-40"
              />
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
                  () => deleteGoodsReceiptAction({ receiptId: deleteTarget }),
                  tActions("deleted")
                )
              }
            >
              {tActions("confirm")}
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