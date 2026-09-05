"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/stores/use-toast-store";
import {
  createUnitAction,
  updateUnitAction,
} from "@/features/units/actions";
import type { Unit } from "@/lib/units/types";

interface UnitFormProps {
  mode: "create" | "edit";
  unit?: Unit | null;
}

const TYPES = ["mass", "volume", "count", "service", "custom"] as const;

export function UnitForm({ mode, unit }: UnitFormProps) {
  const t = useTranslations("units");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const toast = useToast();
  const router = useRouter();

  const [name, setName] = useState(unit?.name ?? "");
  const [symbol, setSymbol] = useState(unit?.symbol ?? "");
  const [type, setType] = useState<string>(unit?.type ?? "mass");
  const [description, setDescription] = useState(unit?.description ?? "");
  const [precision, setPrecision] = useState(String(unit?.precision ?? 2));
  const [isBase, setIsBase] = useState(unit?.is_base ?? false);
  const [isActive, setIsActive] = useState(unit?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = tc("common.required");
    if (!/^[A-Za-zÀ-ÿ0-9%/·_. ]+$/.test(symbol.trim()))
      errs.symbol = tc("common.invalid");
    const precisionNum = Number(precision);
    if (
      !Number.isInteger(precisionNum) ||
      precisionNum < 0 ||
      precisionNum > 6
    )
      errs.precision = tc("common.invalid");
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setBusy(true);
    const result = await (mode === "create"
      ? createUnitAction({
          name: name.trim(),
          symbol: symbol.trim(),
          type,
          description: description.trim() === "" ? null : description.trim(),
          precision: precisionNum,
        })
      : unit
      ? updateUnitAction({
          unitId: unit.id,
          name: name.trim(),
          symbol: symbol.trim(),
          type,
          description: description.trim() === "" ? null : description.trim(),
          precision: precisionNum,
          isBase,
          isActive,
        })
      : null);
    if (!result) return;
    setBusy(false);

    if (result.ok) {
      toast.success({
        title: mode === "create" ? t("createSuccess") : t("updateSuccess"),
      });
      router.push("/units");
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key),
      });
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={mode === "create" ? t("createTitle") : t("editTitle")}
        description={t("description")}
        breadcrumbs={[
          { label: tn("units"), href: "/units" },
          { label: mode === "create" ? t("createTitle") : t("editTitle") },
        ]}
        actions={
          <Button variant="outline" onClick={() => router.push("/units")}>
            {tc("common.cancel")}
          </Button>
        }
      />

      <div className="max-w-2xl space-y-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm">
        <Field
          label={t("fields.name")}
          htmlFor="unit-name"
          required
          error={errors.name}
        >
          <Input
            id="unit-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("fields.namePlaceholder")}
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label={t("fields.symbol")}
            htmlFor="unit-symbol"
            required
            error={errors.symbol}
          >
            <Input
              id="unit-symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder={t("fields.symbolPlaceholder")}
            />
          </Field>

          <Field label={t("fields.type")} htmlFor="unit-type" required>
            <Select
              id="unit-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {TYPES.map((typeKey) => (
                <option key={typeKey} value={typeKey}>
                  {t(`types.${typeKey}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label={t("fields.precision")}
          htmlFor="unit-precision"
          required
          error={errors.precision}
          helpText={t("fields.precisionHint")}
        >
          <Input
            id="unit-precision"
            type="number"
            min={0}
            max={6}
            step={1}
            value={precision}
            onChange={(e) => setPrecision(e.target.value)}
          />
        </Field>

        <Field label={t("fields.description")} htmlFor="unit-description">
          <Textarea
            id="unit-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("fields.descriptionPlaceholder")}
            rows={3}
          />
        </Field>

        {mode === "edit" && (
          <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{t("fields.isActive")}</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{t("fields.isBase")}</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {t("fields.baseHint")}
                </p>
              </div>
              <Switch checked={isBase} onCheckedChange={setIsBase} />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => router.push("/units")}>
            {tc("common.cancel")}
          </Button>
          <Button onClick={submit} loading={busy}>
            {tc("common.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}