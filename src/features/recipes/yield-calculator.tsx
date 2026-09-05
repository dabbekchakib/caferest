"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/shared/field";
import { parseRecipeDecimal } from "@/lib/recipes/formatters";
import { productionFor } from "@/lib/yields/calculations";
import { formatYieldCount } from "@/lib/yields/formatter";
import type {
  YieldDefinition,
  YieldSelection,
} from "@/lib/yields/types";
import type { Unit, UnitConversion } from "@/lib/units/types";

interface YieldCalculatorProps {
  definition: YieldDefinition | null;
  units: Unit[];
  outputUnit: Unit | null;
  conversions: UnitConversion[];
  locale: string;
}

function unitLabel(unit: Unit): string {
  return unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name;
}

/**
 * Yield production projector (spec: "Quantité disponible + Rendement =
 * Production théorique"). Purely client-side and instant: it never writes to
 * the database and never touches stock. The range edition lets a user choose
 * the yield used for the theoretical projection (default: standard).
 */
export function YieldCalculator({
  definition,
  units,
  outputUnit,
  conversions,
  locale,
}: YieldCalculatorProps) {
  const tc = useTranslations("yieldCalculator");
  const tcommon = useTranslations("common");

  const defaultUnitId = definition?.inputUnitId ?? units[0]?.id ?? "";
  const [availableQuantity, setAvailableQuantity] = useState("");
  const [availableUnitId, setAvailableUnitId] = useState(defaultUnitId);
  const [selection, setSelection] = useState<YieldSelection>("standard");

  const hasRange = definition?.yieldType === "range_yield";

  const quantity = useMemo(() => {
    if (availableQuantity.trim() === "") return null;
    return parseRecipeDecimal(availableQuantity);
  }, [availableQuantity]);

  const production = useMemo(() => {
    if (!definition || quantity === null || !Number.isFinite(quantity)) {
      return null;
    }
    if (quantity < 0) return null;
    if (!availableUnitId) return null;
    return productionFor(
      definition,
      quantity,
      availableUnitId,
      conversions,
      selection
    );
  }, [definition, quantity, availableUnitId, conversions, selection]);

  const outputSymbol = outputUnit?.symbol ?? null;

  return (
    <div className="rounded-lg border border-[var(--color-border)] p-3">
      <p className="flex items-center gap-2 text-xs font-semibold text-[var(--color-muted-foreground)]">
        <Calculator className="size-3.5" aria-hidden />
        {tc("title")}
      </p>
      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
        {tc("description")}
      </p>

      {!definition ? (
        <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
          {tc("noDefinition")}
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={tc("availableQuantity")} htmlFor="yield-calc-qty">
              <Input
                id="yield-calc-qty"
                inputMode="decimal"
                value={availableQuantity}
                onChange={(e) => setAvailableQuantity(e.target.value)}
              />
            </Field>
            <Field label={tc("availableUnit")} htmlFor="yield-calc-unit">
              <Select
                id="yield-calc-unit"
                value={availableUnitId}
                onChange={(e) => setAvailableUnitId(e.target.value)}
              >
                <option value="">—</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {unitLabel(u)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {hasRange && (
            <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <legend className="sr-only">{tc("result")}</legend>
              {(
                [
                  ["min", tc("selectionMin")],
                  ["standard", tc("selectionStd")],
                  ["max", tc("selectionMax")],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <input
                    type="radio"
                    name="yield-calc-selection"
                    className="size-4 accent-[var(--color-primary)]"
                    checked={selection === value}
                    onChange={() => setSelection(value)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          )}

          <div className="rounded-lg bg-[var(--color-muted)] p-3">
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {tc("result")}
            </p>
            <p className="mt-1 text-lg font-semibold" aria-live="polite">
              {production !== null
                ? `${formatYieldCount(production, locale)}${
                    outputSymbol ? ` ${outputSymbol}` : ""
                  }`
                : "—"}
            </p>
            {quantity !== null && quantity >= 0 && production === null && (
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {tcommon("invalid")}
              </p>
            )}
            {production !== null && (
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                {tc("resultHint")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}