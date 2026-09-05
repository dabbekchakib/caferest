"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Power, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SearchBar } from "@/components/shared/search-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/stores/use-toast-store";
import {
  deleteSupplierAction,
  setSupplierStatusAction,
} from "@/features/suppliers/actions";
import type {
  SupplierWithRelations,
  SupplierPageResult,
} from "@/lib/suppliers/types";

interface SupplierListProps {
  result: SupplierPageResult;
  query: string;
  status: "all" | "active" | "inactive";
  preferred: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canActivate: boolean;
}

export function SupplierList({
  result,
  query,
  status,
  preferred,
  canCreate,
  canUpdate,
  canDelete,
  canActivate,
}: SupplierListProps) {
  const t = useTranslations("suppliers");
  const tf = useTranslations("supplierFilters");
  const tActions = useTranslations("supplierActions");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const router = useRouter();
  const toast = useToast();

  const [queryInput, setQueryInput] = useState(query);
  const [statusTarget, setStatusTarget] = useState<SupplierWithRelations | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SupplierWithRelations | null>(null);
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
    if ((updates.status ?? status) !== "all") params.set("status", updates.status ?? status);
    if (updates.preferred ? updates.preferred === "1" : preferred) params.set("preferred", "1");
    if (updates.page) params.set("page", updates.page);
    const qs = params.toString();
    router.push(qs ? `/suppliers?${qs}` : "/suppliers");
    router.refresh();
  }

  async function run(action: () => Promise<unknown>, successTitle: string) {
    setBusy(true);
    const resultAction = (await action()) as { ok: boolean; key?: string };
    setBusy(false);
    if (resultAction.ok) {
      toast.success({ title: successTitle });
      setStatusTarget(null);
      setDeleteTarget(null);
      router.push("/suppliers");
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(resultAction.key ?? "authorization.errors.generic"),
      });
    }
  }

  const columns: Column<SupplierWithRelations>[] = [
    {
      key: "name",
      header: t("name"),
      accessor: (row) => (
        <Link href={`/suppliers/${row.id}`} className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{row.name}</span>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {row.code ?? "—"}
          </span>
        </Link>
      ),
      sortable: true,
      sortValue: (row) => row.name,
    },
    {
      key: "city",
      header: t("city"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.city ?? t("noCity")}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.city ?? "",
      hideOnMobile: true,
    },
    {
      key: "catalog",
      header: tf("catalogCount"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.catalogCount}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: t("status"),
      accessor: (row) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {row.is_active ? (
            <Badge variant="success" size="sm" dot>
              {t("active")}
            </Badge>
          ) : (
            <Badge variant="danger" size="sm" dot>
              {t("inactive")}
            </Badge>
          )}
          {(row.is_preferred || row.hasPreferredItems) && (
            <Badge size="sm">{t("preferred")}</Badge>
          )}
        </span>
      ),
    },
    {
      key: "actions",
      header: tc("common.actions"),
      accessor: (row) => (
        <div className="flex items-center gap-0.5">
          {canActivate && (
            <button
              type="button"
              onClick={() => {
                setStatusTarget(row);
                setEnabled(!row.is_active);
              }}
              className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              aria-label={tActions(row.is_active ? "deactivate" : "activate")}
            >
              <Power className="size-4" aria-hidden />
            </button>
          )}
          {canUpdate && (
            <Link
              href={`/suppliers/${row.id}/edit`}
              className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              aria-label={tActions("edit")}
            >
              <Pencil className="size-4" aria-hidden />
            </Link>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeleteTarget(row)}
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

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t("title")}
        breadcrumbs={[{ label: tn("suppliers") }]}
        actions={
          canCreate ? (
            <Link href="/suppliers/create">
              <Button>
                <Plus className="size-4" aria-hidden /> {t("create")}
              </Button>
            </Link>
          ) : undefined
        }
      />

      {result.total === 0 ? (
        <EmptyState
          title={t("noData")}
          action={
            canCreate ? (
              <Link href="/suppliers/create">
                <Button>
                  <Plus className="size-4" aria-hidden /> {t("create")}
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
                {tf("totalCount", { count: result.total })}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                aria-label={tf("status.all")}
                value={status}
                onChange={(e) =>
                  pushQuery({
                    status: e.target.value,
                    page: undefined,
                  })
                }
                className="sm:w-44"
              >
                <option value="all">{tf("status.all")}</option>
                <option value="active">{tf("status.active")}</option>
                <option value="inactive">{tf("status.inactive")}</option>
              </Select>
              <Select
                aria-label={tf("preferredOnly")}
                value={preferred ? "1" : "0"}
                onChange={(e) =>
                  pushQuery({
                    preferred: e.target.value === "1" ? "1" : undefined,
                    page: undefined,
                  })
                }
                className="sm:w-52"
              >
                <option value="0">{tf("all")}</option>
                <option value="1">{tf("preferredOnly")}</option>
              </Select>
              {(queryInput || status !== "all" || preferred) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setQueryInput("");
                    pushQuery({ q: undefined, status: "all", preferred: undefined, page: undefined });
                  }}
                >
                  {tf("clear")}
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
        open={statusTarget !== null}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        title={tActions(enabled ? "activate" : "deactivate")}
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant={enabled ? "success" : "danger"}
              loading={busy}
              onClick={() =>
                statusTarget &&
                void run(
                  () =>
                    setSupplierStatusAction({
                      supplierId: statusTarget.id,
                      isActive: enabled,
                    }),
                  tActions(enabled ? "activated" : "deactivated")
                )
              }
            >
              {tc("common.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {statusTarget?.name}
        </p>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={
          deleteTarget?.catalogCount ? t("deleteSoftTitle") : t("deleteTitle")
        }
        description={
          deleteTarget?.catalogCount ? t("deleteSoftBody") : t("deleteBody")
        }
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
                  () => deleteSupplierAction({ supplierId: deleteTarget.id }),
                  deleteTarget.catalogCount
                    ? tActions("softDeleted")
                    : tActions("deleted")
                )
              }
            >
              {tActions("confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {deleteTarget?.name}
        </p>
      </Dialog>
    </div>
  );
}