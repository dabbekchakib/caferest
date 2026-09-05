"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Plus, Pencil, Trash2, Power, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SearchBar } from "@/components/shared/search-bar";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/stores/use-toast-store";
import {
  createUnitConversionAction,
  updateUnitConversionAction,
  deleteUnitConversionAction,
  setUnitConversionStatusAction,
  convertPreviewAction,
} from "@/features/unit-conversions/actions";
import { formatQuantity } from "@/lib/units/formatter";
import type { Unit, UnitConversion } from "@/lib/units/types";

interface ConversionRow extends UnitConversion {
  fromUnit?: Pick<Unit, "id" | "symbol" | "name" | "type"> | null;
  toUnit?: Pick<Unit, "id" | "symbol" | "name" | "type"> | null;
}

interface ConversionsListProps {
  conversions: ConversionRow[];
  units: Unit[];
  establishmentId: string;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

type EditorState =
  | { mode: "create"; row: null }
  | { mode: "edit"; row: ConversionRow }
  | null;

export function ConversionsList({
  conversions,
  units,
  canCreate,
  canUpdate,
  canDelete,
}: ConversionsListProps) {
  const t = useTranslations("unitConversions");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const toast = useToast();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [statusTarget, setStatusTarget] = useState<ConversionRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConversionRow | null>(null);
  const [busy, setBusy] = useState(false);
  const locale = useLocale();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversions;
    return conversions.filter((c) => {
      const from = c.fromUnit?.symbol ?? c.from_unit_id;
      const to = c.toUnit?.symbol ?? c.to_unit_id;
      return (
        from.toLowerCase().includes(q) ||
        to.toLowerCase().includes(q) ||
        c.from_unit_id.toLowerCase().includes(q) ||
        c.to_unit_id.toLowerCase().includes(q)
      );
    });
  }, [conversions, query]);

  async function run(action: () => Promise<unknown>, successTitle: string) {
    setBusy(true);
    const result = (await action()) as
      | { ok: true }
      | { ok: false; key: string };
    setBusy(false);
    if (result.ok) {
      toast.success({ title: successTitle });
      setEditor(null);
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

  const columns: Column<ConversionRow>[] = [
    {
      key: "conversion",
      header: t("table.conversion"),
      accessor: (row) => (
        <div className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium">
            {row.fromUnit?.symbol ?? "—"}
            <ArrowRight className="size-3.5 text-[var(--color-muted-foreground)]" />
            {row.toUnit?.symbol ?? "—"}
            {row.is_system && (
              <Badge variant="primary" size="sm">
                {t("badges.system")}
              </Badge>
            )}
          </span>
          <span className="block truncate text-xs text-[var(--color-muted-foreground)]">
            {row.fromUnit?.name ?? row.from_unit_id} →{" "}
            {row.toUnit?.name ?? row.to_unit_id}
          </span>
        </div>
      ),
      sortable: true,
      sortValue: (r) => r.fromUnit?.symbol ?? r.from_unit_id,
    },
    {
      key: "factor",
      header: t("table.factor"),
      accessor: (row) => {
        const toUnit = row.toUnit ?? null;
        return (
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {formatQuantity(Number(row.factor), toUnit, locale)}
          </span>
        );
      },
      sortable: true,
      sortValue: (r) => Number(r.factor),
      hideOnMobile: true,
    },
    {
      key: "status",
      header: t("table.status"),
      accessor: (row) =>
        row.is_active ? (
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
      accessor: (row) => (
        <div className="flex items-center gap-0.5">
          {canUpdate && !row.is_system && (
            <>
              <button
                type="button"
                onClick={() => setStatusTarget(row)}
                className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                aria-label={t("actions.toggle")}
              >
                <Power className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => setEditor({ mode: "edit", row })}
                className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                aria-label={t("actions.edit")}
              >
                <Pencil className="size-4" aria-hidden />
              </button>
            </>
          )}
          {canDelete && !row.is_system && (
            <button
              type="button"
              onClick={() => setDeleteTarget(row)}
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
        breadcrumbs={[{ label: tn("unitConversions") }]}
        actions={
          canCreate ? (
            <Button onClick={() => setEditor({ mode: "create", row: null })}>
              <Plus className="size-4" aria-hidden /> {t("createButton")}
            </Button>
          ) : undefined
        }
      />

      <ConversionPreview units={units} />

      <SearchBar
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onClear={() => setQuery("")}
        placeholder={t("searchPlaceholder")}
        className="sm:max-w-sm"
      />

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(c) => c.id}
        striped
      />

      {editor && (
        <ConversionFormDialog
          key={editor.mode === "edit" ? editor.row.id : "create"}
          mode={editor.mode}
          row={editor.mode === "edit" ? editor.row : null}
          units={units}
          busy={busy}
          onClose={() => !busy && setEditor(null)}
          onSubmit={(input) => {
            if (editor.mode === "create") {
              return run(
                () => createUnitConversionAction(input),
                t("createSuccess")
              );
            }
            return run(
              () =>
                updateUnitConversionAction({
                  conversionId: editor.row.id,
                  ...input,
                }),
              t("updateSuccess")
            );
          }}
        />
      )}

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
                    setUnitConversionStatusAction({
                      conversionId: statusTarget.id,
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
          {statusTarget?.fromUnit?.symbol} → {statusTarget?.toUnit?.symbol}
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
                  () =>
                    deleteUnitConversionAction({
                      conversionId: deleteTarget.id,
                    }),
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
          {deleteTarget?.fromUnit?.symbol} → {deleteTarget?.toUnit?.symbol}
        </p>
      </Dialog>
    </div>
  );
}

interface ConversionFormInput {
  from_unit_id: string;
  to_unit_id: string;
  factor: number;
  offset?: number;
}

interface ConversionFormDialogProps {
  mode: "create" | "edit";
  row: ConversionRow | null;
  units: Unit[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: ConversionFormInput) => void;
}

function ConversionFormDialog({
  mode,
  row,
  units,
  busy,
  onClose,
  onSubmit,
}: ConversionFormDialogProps) {
  const t = useTranslations("unitConversions");
  const tc = useTranslations("common");

  const [fromUnitId, setFromUnitId] = useState(
    row?.from_unit_id ?? units[0]?.id ?? ""
  );
  const [toUnitId, setToUnitId] = useState(
    row?.to_unit_id ?? units[1]?.id ?? ""
  );
  const [factor, setFactor] = useState(row ? String(Number(row.factor)) : "1");
  const [offset, setOffset] = useState(String(Number(row?.offset_value ?? 0)));
  const [isActive, setIsActive] = useState(row?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function submit() {
    const errs: Record<string, string> = {};
    if (!fromUnitId || !toUnitId) errs.units = tc("common.required");
    if (fromUnitId === toUnitId) errs.to_unit_id = t("errors.sameUnit");
    const factorNum = Number(factor);
    if (!Number.isFinite(factorNum) || factorNum <= 0)
      errs.factor = tc("common.invalid");
    const offsetNum = Number(offset);
    if (!Number.isFinite(offsetNum)) errs.offset = tc("common.invalid");
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    onSubmit({
      from_unit_id: fromUnitId,
      to_unit_id: toUnitId,
      factor: factorNum,
      offset: offsetNum !== 0 ? offsetNum : undefined,
      ...(mode === "edit" ? { is_active: isActive } : {}),
    });
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Unit[]>();
    for (const unit of units) {
      if (!map.has(unit.type)) map.set(unit.type, []);
      map.get(unit.type)!.push(unit);
    }
    return [...map.entries()];
  }, [units]);

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={mode === "create" ? t("createTitle") : t("editTitle")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {tc("common.cancel")}
          </Button>
          <Button onClick={submit} loading={busy}>
            {tc("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {errors.units && (
          <p role="alert" className="text-xs text-[var(--color-danger)]">
            {errors.units}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={t("fields.fromUnit")}
            htmlFor="conv-from"
            required
            error={errors.from_unit_id}
          >
            <Select
              id="conv-from"
              value={fromUnitId}
              onChange={(e) => setFromUnitId(e.target.value)}
            >
              {grouped.map(([typeKey, typeUnits]) => (
                <optgroup key={typeKey} label={typeKey}>
                  {typeUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.symbol})
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field
            label={t("fields.toUnit")}
            htmlFor="conv-to"
            required
            error={errors.to_unit_id}
          >
            <Select
              id="conv-to"
              value={toUnitId}
              onChange={(e) => setToUnitId(e.target.value)}
            >
              {grouped.map(([typeKey, typeUnits]) => (
                <optgroup key={typeKey} label={typeKey}>
                  {typeUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.symbol})
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label={t("fields.factor")}
            htmlFor="conv-factor"
            required
            error={errors.factor}
            helpText={t("fields.factorHint", {
              factor: factor || "…",
            })}
          >
            <Input
              id="conv-factor"
              type="number"
              min={0}
              step="any"
              value={factor}
              onChange={(e) => setFactor(e.target.value)}
            />
          </Field>
          <Field
            label={t("fields.offset")}
            htmlFor="conv-offset"
            error={errors.offset}
            helpText={t("fields.offsetHint")}
          >
            <Input
              id="conv-offset"
              type="number"
              step="any"
              value={offset}
              onChange={(e) => setOffset(e.target.value)}
            />
          </Field>
        </div>
        {mode === "edit" && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("fields.isActive")}</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        )}
      </div>
    </Dialog>
  );
}

function ConversionPreview({ units }: { units: Unit[] }) {
  const t = useTranslations("unitConversions");
  const tRoot = useTranslations();
  const locale = useLocale();

  const [fromUnitId, setFromUnitId] = useState(units[0]?.id ?? "");
  const [toUnitId, setToUnitId] = useState(units[1]?.id ?? "");
  const [value, setValue] = useState("1");
  const [result, setResult] = useState<{
    value: number;
    toSymbol?: string;
  } | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toUnit = units.find((u) => u.id === toUnitId);

  async function convert() {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      setErrorKey(null);
      setResult(null);
      return;
    }
    setBusy(true);
    const res = await convertPreviewAction({
      fromUnitId,
      toUnitId,
      value: num,
    });
    setBusy(false);
    if (res.ok) {
      setResult(res.data);
      setErrorKey(null);
    } else {
      setResult(null);
      setErrorKey(res.key);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t("fields.fromUnit")} htmlFor="preview-from">
          <Select
            id="preview-from"
            value={fromUnitId}
            onChange={(e) => {
              setFromUnitId(e.target.value);
              setResult(null);
            }}
            className="sm:w-44"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.symbol}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={t("fields.factor")}
          htmlFor="preview-value"
        >
          <Input
            id="preview-value"
            type="number"
            step="any"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setResult(null);
            }}
            className="sm:w-32"
          />
        </Field>
        <Field label={t("fields.toUnit")} htmlFor="preview-to">
          <Select
            id="preview-to"
            value={toUnitId}
            onChange={(e) => {
              setToUnitId(e.target.value);
              setResult(null);
            }}
            className="sm:w-44"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.symbol}
              </option>
            ))}
          </Select>
        </Field>
        <Button onClick={convert} loading={busy}>
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
      {result && (
        <p className="mt-3 text-sm font-medium">
          {formatQuantity(Number(value), units.find((u) => u.id === fromUnitId), locale)}
          {" = "}
          {formatQuantity(result.value, toUnit, locale)}
        </p>
      )}
      {errorKey && (
        <p role="alert" className="mt-3 text-xs text-[var(--color-danger)]">
          {tRoot(errorKey)}
        </p>
      )}
    </div>
  );
}