"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/shared/field";
import { useToast } from "@/stores/use-toast-store";
import {
  saveRecipeYieldAction,
  setRecipeYieldActiveAction,
  deleteRecipeYieldAction,
} from "@/features/recipes/yield-actions";
import { parseRecipeDecimal } from "@/lib/recipes/formatters";
import {
  formatYieldQuantity,
  formatYieldCount,
  formatYieldCost,
} from "@/lib/yields/formatter";
import { yieldOutputsPerBatch } from "@/lib/yields/calculations";
import { YieldCalculator } from "@/features/recipes/yield-calculator";
import type { YieldDefinition, YieldType } from "@/lib/yields/types";
import type { Unit, UnitConversion } from "@/lib/units/types";
import type { TheoreticalConsumptionResult } from "@/services/yields-service";

export type YieldRowInput = {
  yield_type: string;
  input_quantity: number | null;
  input_unit_id: string | null;
  output_quantity: number | null;
  output_unit_id: string | null;
  minimum_yield: number | null;
  standard_yield: number | null;
  maximum_yield: number | null;
  yield_percentage: number | null;
  notes: string | null;
  is_active: boolean;
};

interface RecipeYieldSectionProps {
  recipeId: string;
  row: YieldRowInput | null;
  units: Unit[];
  conversions?: UnitConversion[];
  canEdit: boolean;
  canViewCost: boolean;
  batchCost: number | null;
  initialConsumption?: TheoreticalConsumptionResult | null;
}

const MODELS: YieldType[] = [
  "exact_consumption",
  "batch_yield",
  "range_yield",
  "portion_yield",
  "percentage_yield",
];

function toDefinition(row: YieldRowInput | null): YieldDefinition | null {
  if (!row) return null;
  return {
    yieldType: (row.yield_type as YieldType) ?? "exact_consumption",
    inputQuantity: row.input_quantity,
    inputUnitId: row.input_unit_id,
    outputQuantity: row.output_quantity,
    outputUnitId: row.output_unit_id,
    minimumYield: row.minimum_yield,
    standardYield: row.standard_yield,
    maximumYield: row.maximum_yield,
    yieldPercentage: row.yield_percentage,
    isActive: row.is_active,
  };
}

function num(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

function unitLabel(unit: Unit): string {
  return unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name;
}

export function RecipeYieldSection({
  recipeId,
  row,
  units,
  conversions = [],
  canEdit,
  canViewCost,
  batchCost,
  initialConsumption,
}: RecipeYieldSectionProps) {
  const t = useTranslations("yield");
  const tf = useTranslations("yieldForm");
  const tty = useTranslations("yieldTypes");
  const tp = useTranslations("yieldPreview");
  const tv = useTranslations("yieldValidation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const toast = useToast();

  const [editing, setEditing] = useState(!row && canEdit);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [rowState, setRowState] = useState<YieldRowInput | null>(row);

  const [model, setModel] = useState<YieldType>(
    row?.yield_type ? (row.yield_type as YieldType) : "range_yield"
  );
  const [inputQuantity, setInputQuantity] = useState(num(row?.input_quantity));
  const [inputUnitId, setInputUnitId] = useState(row?.input_unit_id ?? "");
  const [outputQuantity, setOutputQuantity] = useState(num(row?.output_quantity));
  const [outputUnitId, setOutputUnitId] = useState(row?.output_unit_id ?? "");
  const [minYield, setMinYield] = useState(num(row?.minimum_yield));
  const [stdYield, setStdYield] = useState(num(row?.standard_yield));
  const [maxYield, setMaxYield] = useState(num(row?.maximum_yield));
  const [yieldPct, setYieldPct] = useState(num(row?.yield_percentage));
  const [notes, setNotes] = useState(row?.notes ?? "");
  const [isActive, setIsActive] = useState(row?.is_active ?? true);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const def = toDefinition(rowState);
  const inputUnit = def ? (units.find((u) => u.id === def.inputUnitId) ?? null) : null;
  const outputUnit = def
    ? (units.find((u) => u.id === def.outputUnitId) ?? null)
    : null;

  const perServing = def
    ? {
        min:
          def.yieldType === "range_yield" && def.minimumYield && def.inputQuantity
            ? def.inputQuantity / def.minimumYield
            : null,
        standard:
          def.inputQuantity && def.outputQuantity
            ? def.inputQuantity / def.outputQuantity
            : def.inputQuantity && def.standardYield
              ? def.inputQuantity / def.standardYield
              : null,
        max:
          def.yieldType === "range_yield" && def.maximumYield && def.inputQuantity
            ? def.inputQuantity / def.maximumYield
            : null,
        percentage:
          def.yieldType === "percentage_yield" && def.yieldPercentage
            ? 100 / def.yieldPercentage
            : null,
      }
    : null;

  const batchOutput = def ? yieldOutputsPerBatch(def, "standard") : null;
  const costPerServing =
    canViewCost && batchCost !== null && batchOutput?.count
      ? batchCost / batchOutput.count
      : null;

  function parse(v: string): number | null | undefined {
    if (v.trim() === "") return null;
    const n = parseRecipeDecimal(v);
    return n === null ? undefined : n;
  }

  async function save() {
    const errs: Record<string, string> = {};
    const input = parse(inputQuantity);
    if (input === undefined) errs.inputQuantity = tc("common.invalid");
    const output = parse(outputQuantity);
    if (
      model !== "percentage_yield" &&
      model !== "range_yield" &&
      output === undefined
    ) {
      errs.outputQuantity = tc("common.invalid");
    }
    const s = parse(stdYield);
    if (model === "range_yield" && s === undefined) {
      errs.standardYield = tc("common.invalid");
    }
    const pct = parse(yieldPct);
    if (
      model === "percentage_yield" &&
      (pct === undefined || pct === null || pct <= 0 || pct > 100)
    ) {
      errs.yieldPercentage = tv("percentageRange");
    }
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    const result = await saveRecipeYieldAction({
      recipeId,
      yieldType: model,
      inputQuantity: input ?? null,
      inputUnitId: inputUnitId || null,
      outputQuantity: output ?? null,
      outputUnitId: outputUnitId || null,
      minimumYield: model === "range_yield" ? (parse(minYield) ?? null) : null,
      standardYield: s ?? null,
      maximumYield: model === "range_yield" ? (parse(maxYield) ?? null) : null,
      yieldPercentage: pct ?? null,
      notes: notes.trim() === "" ? null : notes.trim(),
      isActive,
    });
    setBusy(false);
    if (result.ok) {
      toast.success({
        title: result.data.created ? tf("createdTitle") : tf("saveSuccessTitle"),
      });
      setEditing(false);
      setRowState({
        yield_type: model,
        input_quantity: input ?? null,
        input_unit_id: inputUnitId || null,
        output_quantity: output ?? null,
        output_unit_id: outputUnitId || null,
        minimum_yield: model === "range_yield" ? (parse(minYield) ?? null) : null,
        standard_yield: s ?? null,
        maximum_yield: model === "range_yield" ? (parse(maxYield) ?? null) : null,
        yield_percentage: pct ?? null,
        notes: notes.trim() === "" ? null : notes.trim(),
        is_active: isActive,
      });
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  async function toggleActive(next: boolean) {
    setIsActive(next);
    if (!rowState) return;
    setBusy(true);
    const result = await setRecipeYieldActiveAction({ recipeId, isActive: next });
    setBusy(false);
    if (result.ok) {
      setRowState({ ...rowState, is_active: next });
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  function resetForm() {
    setModel("range_yield");
    setInputQuantity("");
    setInputUnitId("");
    setOutputQuantity("");
    setOutputUnitId("");
    setMinYield("");
    setStdYield("");
    setMaxYield("");
    setYieldPct("");
    setNotes("");
    setIsActive(true);
    setFormErrors({});
  }

  async function doDelete() {
    setBusy(true);
    const result = await deleteRecipeYieldAction({ recipeId });
    setBusy(false);
    if (result.ok) {
      toast.success({ title: tf("deleteSuccessTitle") });
      setConfirmingDelete(false);
      setEditing(false);
      setRowState(null);
      resetForm();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <FlaskConical
              className="size-4 text-[var(--color-muted-foreground)]"
              aria-hidden
            />
            {t("title")}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
            {t("subtitle")}
          </p>
        </div>
        {rowState &&
          (canEdit ? (
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch
                checked={rowState.is_active}
                onCheckedChange={toggleActive}
                disabled={busy}
              />
              {rowState.is_active ? tp("activeBadge") : tp("inactiveBadge")}
            </label>
          ) : (
            <Badge variant={rowState.is_active ? "success" : "muted"}>
              {rowState.is_active ? tp("activeBadge") : tp("inactiveBadge")}
            </Badge>
          ))}
        {canEdit && !editing && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {!rowState ? tf("createTitle") : tf("editTitle")}
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          <Field label={tf("typeLabel")} htmlFor="yield-model">
            <Select
              id="yield-model"
              value={model}
              onChange={(e) => {
                setModel(e.target.value as YieldType);
                setFormErrors({});
              }}
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {tty(m)}
                </option>
              ))}
            </Select>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label={tf("inputQuantityLabel")}
              htmlFor="yield-input-qty"
              error={formErrors.inputQuantity}
            >
              <Input
                id="yield-input-qty"
                inputMode="decimal"
                value={inputQuantity}
                onChange={(e) => {
                  setInputQuantity(e.target.value);
                  setFormErrors({});
                }}
              />
            </Field>
            <Field label={tf("inputUnitLabel")} htmlFor="yield-input-unit">
              <Select
                id="yield-input-unit"
                value={inputUnitId}
                onChange={(e) => {
                  setInputUnitId(e.target.value);
                  setFormErrors({});
                }}
              >
                <option value="">—</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {unitLabel(u)}
                  </option>
                ))}
              </Select>
            </Field>

            {model === "range_yield" ? (
              <>
                <Field label={tf("minimumLabel")} htmlFor="yield-min">
                  <Input
                    id="yield-min"
                    inputMode="decimal"
                    value={minYield}
                    onChange={(e) => {
                      setMinYield(e.target.value);
                      setFormErrors({});
                    }}
                  />
                </Field>
                <Field
                  label={tf("standardLabel")}
                  htmlFor="yield-std"
                  error={formErrors.standardYield}
                >
                  <Input
                    id="yield-std"
                    inputMode="decimal"
                    value={stdYield}
                    onChange={(e) => {
                      setStdYield(e.target.value);
                      setFormErrors({});
                    }}
                  />
                </Field>
                <Field label={tf("maximumLabel")} htmlFor="yield-max">
                  <Input
                    id="yield-max"
                    inputMode="decimal"
                    value={maxYield}
                    onChange={(e) => {
                      setMaxYield(e.target.value);
                      setFormErrors({});
                    }}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field
                  label={tf("outputQuantityLabel")}
                  htmlFor="yield-output-qty"
                  error={
                    model !== "percentage_yield"
                      ? formErrors.outputQuantity
                      : undefined
                  }
                >
                  <Input
                    id="yield-output-qty"
                    inputMode="decimal"
                    value={outputQuantity}
                    onChange={(e) => {
                      setOutputQuantity(e.target.value);
                      setFormErrors({});
                    }}
                    disabled={model === "percentage_yield"}
                  />
                </Field>
                <Field label={tf("outputUnitLabel")} htmlFor="yield-output-unit">
                  <Select
                    id="yield-output-unit"
                    value={outputUnitId}
                    onChange={(e) => {
                      setOutputUnitId(e.target.value);
                      setFormErrors({});
                    }}
                  >
                    <option value="">—</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {unitLabel(u)}
                      </option>
                    ))}
                  </Select>
                </Field>
                {model === "percentage_yield" && (
                  <Field
                    label={tf("percentageLabel")}
                    htmlFor="yield-pct"
                    helpText={tf("percentageHint")}
                    error={formErrors.yieldPercentage}
                    className="sm:col-span-2"
                  >
                    <Input
                      id="yield-pct"
                      inputMode="decimal"
                      value={yieldPct}
                      onChange={(e) => {
                        setYieldPct(e.target.value);
                        setFormErrors({});
                      }}
                    />
                  </Field>
                )}
              </>
            )}
          </div>

          <Field label={tf("notesLabel")} htmlFor="yield-notes">
            <Input
              id="yield-notes"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                setFormErrors({});
              }}
              placeholder={tf("notesPlaceholder")}
            />
          </Field>

          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                disabled={busy}
              />
              {tf("activeToggle")}
            </label>
          </div>

          <div className="flex justify-between gap-2 border-t border-[var(--color-border)] pt-4">
            {rowState ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
              >
                {tf("deleteTitle")}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(false)}>
                {tf("cancel")}
              </Button>
              <Button onClick={save} loading={busy}>
                {tf("save")}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <ReadOnlyAssessment
          def={def}
          inputUnit={inputUnit}
          outputUnit={outputUnit}
          perServing={perServing}
          batchOutput={batchOutput}
          costPerServing={costPerServing}
          canViewCost={canViewCost}
          initialConsumption={initialConsumption}
          conversions={conversions}
          units={units}
          locale={locale}
        />
      )}

      <Dialog
        open={confirmingDelete}
        onOpenChange={(open) => !open && !busy && setConfirmingDelete(false)}
        size="sm"
        title={tf("deleteTitle")}
        description={tf("deleteConfirmMessage")}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setConfirmingDelete(false)}
              disabled={busy}
            >
              {tf("cancel")}
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void doDelete()}>
              {tf("deleteConfirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {tf("deleteConfirmMessage")}
        </p>
      </Dialog>
    </Card>
  );
}

function ReadOnlyAssessment({
  def,
  inputUnit,
  outputUnit,
  perServing,
  batchOutput,
  costPerServing,
  canViewCost,
  initialConsumption,
  conversions,
  units,
  locale,
}: {
  def: YieldDefinition | null;
  inputUnit: Unit | null;
  outputUnit: Unit | null;
  perServing: {
    min: number | null;
    standard: number | null;
    max: number | null;
    percentage: number | null;
  } | null;
  batchOutput: { count: number; unitId: string } | null;
  costPerServing: number | null;
  canViewCost: boolean;
  initialConsumption?: TheoreticalConsumptionResult | null;
  conversions: UnitConversion[];
  units: Unit[];
  locale: string;
}) {
  const tp = useTranslations("yieldPreview");
  const tco = useTranslations("yieldConsumption");

  if (!def) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {tp("empty")}
      </p>
    );
  }

  const symbol = inputUnit?.symbol ?? null;

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border)] p-3">
          <dt className="text-xs text-[var(--color-muted-foreground)]">
            {tp("perServingLabel")}
          </dt>
          <dd className="mt-1 text-base font-semibold">
            {def.yieldType === "percentage_yield"
              ? formatYieldQuantity(perServing?.percentage ?? null, symbol, locale)
              : formatYieldQuantity(perServing?.standard ?? null, symbol, locale)}
          </dd>
          {def.yieldType === "range_yield" &&
            perServing &&
            (perServing.min !== null || perServing.max !== null) && (
              <dd className="mt-2 space-y-0.5 text-xs text-[var(--color-muted-foreground)]">
                <p>
                  {tco("minimum")}:{" "}
                  {formatYieldQuantity(perServing.min, symbol, locale)}
                </p>
                <p>
                  {tco("standard")}:{" "}
                  {formatYieldQuantity(perServing.standard, symbol, locale)}
                </p>
                <p>
                  {tco("maximum")}:{" "}
                  {formatYieldQuantity(perServing.max, symbol, locale)}
                </p>
              </dd>
            )}
        </div>

        <div className="rounded-lg border border-[var(--color-border)] p-3">
          <dt className="text-xs text-[var(--color-muted-foreground)]">
            {tp("perBatchLabel")}
          </dt>
          <dd className="mt-1 text-base font-semibold">
            {def.yieldType === "percentage_yield"
              ? "—"
              : formatYieldCount(batchOutput?.count ?? null, locale)}
            {batchOutput?.count && outputUnit ? ` ${outputUnit.symbol ?? ""}`.trim() : ""}
          </dd>
        </div>

        {canViewCost && (
          <div className="rounded-lg border border-[var(--color-border)] p-3 sm:col-span-2">
            <dt className="text-xs text-[var(--color-muted-foreground)]">
              {tp("costPerServing")}
            </dt>
            <dd className="mt-1 text-base font-semibold">
              {formatYieldCost(costPerServing, locale)}
            </dd>
            {!costPerServing && (
              <dd className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {tp("missingCostHint")}
              </dd>
            )}
          </div>
        )}
      </dl>

      {initialConsumption && initialConsumption.consumed && (
        <div>
          <p className="text-xs font-medium text-[var(--color-muted-foreground)]">
            {tco("title")}
          </p>
          {initialConsumption.items.length === 0 ? (
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              {tco("none")}
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-xs text-[var(--color-muted-foreground)]">
                    <th className="py-2 pr-3 font-medium">{tco("ingredient")}</th>
                    <th className="py-2 pr-3 text-end font-medium">
                      {tco("batch")}
                    </th>
                    <th className="py-2 text-end font-medium">
                      {tco("perServing")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {initialConsumption.items.map((item) => (
                    <tr key={item.itemId}>
                      <td className="truncate py-2 pr-3">{item.label}</td>
                      <td className="whitespace-nowrap py-2 pr-3 text-end text-[var(--color-muted-foreground)]">
                        {formatYieldQuantity(item.quantity, item.unitSymbol, locale)}
                      </td>
                      <td className="whitespace-nowrap py-2 text-end font-medium">
                        {formatYieldQuantity(item.perOutput, item.unitSymbol, locale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <YieldCalculator
        definition={def}
        units={units}
        outputUnit={outputUnit}
        conversions={conversions}
        locale={locale}
      />
    </div>
  );
}