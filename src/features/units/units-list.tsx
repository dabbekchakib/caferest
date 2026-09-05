"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Pencil, Trash2, Power } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SearchBar } from "@/components/shared/search-bar";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/stores/use-toast-store";
import {
  setUnitStatusAction,
  deleteUnitAction,
} from "@/features/units/actions";
import type { Unit } from "@/lib/units/types";

interface UnitsListProps {
  units: Unit[];
  establishmentId: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

type UnitTypeFilter = "all" | Unit["type"];

export function UnitsList({
  units,
  canCreate,
  canUpdate,
  canDelete,
}: UnitsListProps) {
  const t = useTranslations("units");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const toast = useToast();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<UnitTypeFilter>("all");
  const [statusTarget, setStatusTarget] = useState<Unit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return units.filter((u) => {
      if (typeFilter !== "all" && u.type !== typeFilter) return false;
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.symbol.toLowerCase().includes(q) ||
        (u.slug?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [units, query, typeFilter]);

  async function run(action: () => Promise<unknown>, successTitle: string) {
    setBusy(true);
    const result = (await action()) as
      | { ok: true }
      | { ok: false; key: string };
    setBusy(false);
    if (result.ok) {
      toast.success({ title: successTitle });
      setStatusTarget(null);
      setDeleteTarget(null);
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key),
      });
    }
  }

  const columns: Column<Unit>[] = [
    {
      key: "unit",
      header: t("table.unit"),
      accessor: (unit) => (
        <div className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium">
            {unit.name}
            {unit.is_system ? (
              <Badge variant="primary" size="sm">
                {t("badges.system")}
              </Badge>
            ) : (
              <Badge variant="accent" size="sm">
                {t("badges.custom")}
              </Badge>
            )}
            {unit.is_base && (
              <Badge variant="outline" size="sm">
                {t("badges.base")}
              </Badge>
            )}
          </span>
          {unit.description && (
            <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
              {unit.description}
            </span>
          )}
        </div>
      ),
      sortable: true,
      sortValue: (u) => u.name,
    },
    {
      key: "symbol",
      header: t("table.symbol"),
      accessor: (unit) => (
        <code className="rounded bg-[var(--color-muted)] px-1.5 py-0.5 text-xs">
          {unit.symbol}
        </code>
      ),
    },
    {
      key: "type",
      header: t("table.type"),
      accessor: (unit) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {t(`types.${unit.type}`)}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "precision",
      header: t("table.precision"),
      accessor: (unit) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {unit.precision}
        </span>
      ),
      sortable: true,
      sortValue: (u) => u.precision,
      hideOnMobile: true,
    },
    {
      key: "status",
      header: t("table.status"),
      accessor: (unit) =>
        unit.is_active ? (
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
      accessor: (unit) => (
        <div className="flex items-center gap-0.5">
          {canUpdate && !unit.is_system && (
            <>
              <button
                type="button"
                onClick={() => setStatusTarget(unit)}
                className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                aria-label={t("actions.toggle")}
              >
                <Power className="size-4" aria-hidden />
              </button>
              <Link
                href={`/units/${unit.id}/edit`}
                className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                aria-label={t("actions.edit")}
              >
                <Pencil className="size-4" aria-hidden />
              </Link>
            </>
          )}
          {canDelete && !unit.is_system && (
            <button
              type="button"
              onClick={() => setDeleteTarget(unit)}
              className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-danger)]"
              aria-label={t("actions.delete")}
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
        description={t("description")}
        breadcrumbs={[{ label: tn("units") }]}
        actions={
          canCreate ? (
            <Link href="/units/create">
              <Button>
                <Plus className="size-4" aria-hidden /> {t("createButton")}
              </Button>
            </Link>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchBar
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          placeholder={t("searchPlaceholder")}
          className="sm:max-w-sm"
        />
        <Select
          aria-label={t("table.type")}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as UnitTypeFilter)}
          className="sm:w-48"
        >
          <option value="all">{t("types.all")}</option>
          {(["mass", "volume", "count", "service", "custom"] as const).map(
            (key) => (
              <option key={key} value={key}>
                {t(`types.${key}`)}
              </option>
            )
          )}
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(u) => u.id}
        striped
      />

      <Dialog
        open={statusTarget !== null}
        onOpenChange={(o) => !o && setStatusTarget(null)}
        title={t(
          statusTarget?.is_active
            ? "toggleDialog.deactivateTitle"
            : "toggleDialog.activateTitle"
        )}
        footer={
          <>
            <Button variant="outline" onClick={() => setStatusTarget(null)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant={statusTarget?.is_active ? "danger" : "success"}
              loading={busy}
              onClick={() =>
                statusTarget &&
                void run(
                  () =>
                    setUnitStatusAction({
                      unitId: statusTarget.id,
                      isActive: !statusTarget.is_active,
                    }),
                  t("updateSuccess")
                )
              }
            >
              {t("toggleDialog.confirm")}
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
        title={t("deleteDialog.title")}
        description={t("deleteDialog.description")}
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
                  () => deleteUnitAction({ unitId: deleteTarget.id }),
                  t("actions.delete")
                )
              }
            >
              {t("deleteDialog.confirm")}
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