"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/stores/use-toast-store";
import {
  createRecipeAction,
  updateRecipeAction,
} from "@/features/recipes/actions";
import { parseRecipeDecimal } from "@/lib/recipes/formatters";
import { resolveProductName } from "@/lib/products/translations";
import type { ProductWithTranslations } from "@/lib/products/types";
import type { Unit } from "@/lib/units/types";
import type { RecipeWithTranslations } from "@/lib/recipes/types";

const YIELD_TYPES = ["exact_consumption", "batch_yield", "range_yield"] as const;

interface RecipeFormProps {
  mode: "create" | "edit";
  recipe?: RecipeWithTranslations | null;
  products: ProductWithTranslations[];
  units: Unit[];
  readOnly?: boolean;
}

type LocaleValues = {
  name: string;
  description: string;
  notes: string;
};

export function RecipeForm({
  mode,
  recipe,
  products,
  units,
  readOnly = false,
}: RecipeFormProps) {
  const t = useTranslations("recipeForm");
  const tn = useTranslations("navigation");
  const tr = useTranslations("recipes");
  const ty = useTranslations("recipeYield");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const tRoot = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();

  const [name, setName] = useState(recipe?.name ?? "");
  const [description, setDescription] = useState(recipe?.description ?? "");
  const [notes, setNotes] = useState(recipe?.notes ?? "");
  const [productId, setProductId] = useState(recipe?.product_id ?? "");
  const [yieldType, setYieldType] = useState<
    RecipeWithTranslations["yield_type"] | "exact_consumption"
  >(recipe?.yield_type ?? "exact_consumption");
  const [defaultYield, setDefaultYield] = useState(
    recipe?.default_yield != null && Number(recipe.default_yield) > 0
      ? String(recipe.default_yield)
      : ""
  );
  const [yieldUnitId, setYieldUnitId] = useState(recipe?.yield_unit_id ?? null);
  const [preparationTime, setPreparationTime] = useState(
    recipe?.preparation_time != null ? String(recipe.preparation_time) : ""
  );
  const [sortOrder, setSortOrder] = useState(
    recipe?.sort_order != null ? String(recipe.sort_order) : ""
  );
  const [translations, setTranslations] = useState<{
    en: LocaleValues;
    ar: LocaleValues;
  }>({
    en: {
      name: recipe?.translations.en?.name ?? "",
      description: recipe?.translations.en?.description ?? "",
      notes: recipe?.translations.en?.notes ?? "",
    },
    ar: {
      name: recipe?.translations.ar?.name ?? "",
      description: recipe?.translations.ar?.description ?? "",
      notes: recipe?.translations.ar?.notes ?? "",
    },
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function localeValues(key: "en" | "ar", field: keyof LocaleValues): string {
    return translations[key]?.[field] ?? "";
  }

  function setLocaleValue(
    key: "en" | "ar",
    field: keyof LocaleValues,
    value: string
  ) {
    setTranslations((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  async function submit() {
    const errs: Record<string, string> = {};
    if (name.trim().length < 2) errs.name = tv("required");
    if (mode === "create" && !productId) errs.product = t("noProduct");

    const yieldValue = parseRecipeDecimal(defaultYield);
    if (defaultYield.trim() !== "" && (yieldValue === null || yieldValue <= 0)) {
      errs.defaultYield = tv("positive");
    }

    if (preparationTime.trim() !== "") {
      const prep = Number(preparationTime);
      if (!Number.isInteger(prep) || prep < 0) {
        errs.preparationTime = tv("invalidValue");
      }
    }

    if (sortOrder.trim() !== "") {
      const order = Number(sortOrder);
      if (!Number.isInteger(order) || order < 0) {
        errs.sortOrder = tv("invalidValue");
      }
    }

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const clean = (value: string) => (value.trim() === "" ? null : value.trim());

    const payload = {
      name: name.trim(),
      description: clean(description),
      notes: clean(notes),
      yieldType,
      defaultYield: yieldValue ?? 1,
      yieldUnitId: yieldUnitId ?? null,
      preparationTime:
        preparationTime.trim() === "" ? null : Number(preparationTime),
      sortOrder: sortOrder.trim() === "" ? undefined : Number(sortOrder),
      translations: {
        en: {
          name: translations.en.name.trim(),
          description: clean(translations.en.description),
          notes: clean(translations.en.notes),
        },
        ar: {
          name: translations.ar.name.trim(),
          description: clean(translations.ar.description),
          notes: clean(translations.ar.notes),
        },
      },
    };

    setBusy(true);
    const result =
      mode === "create"
        ? await createRecipeAction({ ...payload, productId })
        : recipe
          ? await updateRecipeAction({ ...payload, recipeId: recipe.id })
          : null;
    if (!result) return;
    setBusy(false);

    if (result.ok) {
      toast.success({ title: mode === "create" ? t("createTitle") : t("editTitle") });
      const targetId = mode === "create" ? result.data?.id : recipe?.id;
      if (targetId) {
        router.push(`/recipes/${targetId}`);
        router.refresh();
      }
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  const backHref = mode === "edit" && recipe ? `/recipes/${recipe.id}` : "/recipes";

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={mode === "create" ? t("createTitle") : t("editTitle")}
        description={tr("breadcrumb")}
        breadcrumbs={[
          { label: tn("recipes"), href: "/recipes" },
          { label: mode === "create" ? t("createTitle") : t("editTitle") },
        ]}
        actions={
          <Button variant="outline" onClick={() => router.push(backHref)}>
            {tc("common.cancel")}
          </Button>
        }
      />

      {!readOnly ? (
        <div className="max-w-3xl space-y-5">
          <Card className="space-y-4 p-5">
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">
                {t("sectionGeneral")}
              </legend>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  label={t("nameLabel")}
                  htmlFor="recipe-name"
                  required
                  error={errors.name}
                  helpText={t("recipeNameHint")}
                >
                  <Input
                    id="recipe-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("nameplaceholder")}
                  />
                </Field>
                {mode === "create" ? (
                  <Field
                    label={t("productLabel")}
                    htmlFor="recipe-product"
                    required
                    error={errors.product}
                  >
                    <Select
                      id="recipe-product"
                      value={productId}
                      onChange={(e) => setProductId(e.target.value)}
                    >
                      <option value="">{t("productPlaceholder")}</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {resolveProductName(
                            product.name,
                            product.translations,
                            locale
                          )}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-[var(--color-foreground)]">
                      {t("productLabel")}
                    </span>
                    <div className="flex h-11 items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-muted)] px-3 text-sm text-[var(--color-muted-foreground)]">
                      {products.find((p) => p.id === recipe?.product_id)?.name ??
                        t("noProduct")}
                    </div>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {tr("title")}
                    </p>
                  </div>
                )}
              </div>
              <Field
                label={t("descriptionLabel")}
                htmlFor="recipe-description"
              >
                <Textarea
                  id="recipe-description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("descriptionPlaceholder")}
                />
              </Field>
              <Field label={t("notesLabel")} htmlFor="recipe-notes">
                <Textarea
                  id="recipe-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("notesPlaceholder")}
                />
              </Field>
            </fieldset>
          </Card>

          <Card className="space-y-4 p-5">
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">{t("sectionYield")}</legend>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <Field
                  label={t("yieldTypeLabel")}
                  htmlFor="recipe-yield-type"
                  helpText={t("yieldTypeHint")}
                >
                  <Select
                    id="recipe-yield-type"
                    value={yieldType}
                    onChange={(e) => setYieldType(e.target.value as typeof yieldType)}
                  >
                    {YIELD_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {ty(type)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field
                  label={t("defaultYieldLabel")}
                  htmlFor="recipe-default-yield"
                  error={errors.defaultYield}
                >
                  <Input
                    id="recipe-default-yield"
                    inputMode="decimal"
                    value={defaultYield}
                    onChange={(e) => setDefaultYield(e.target.value)}
                    placeholder={t("defaultYieldPlaceholder")}
                  />
                </Field>
                <Field
                  label={t("yieldUnitLabel")}
                  htmlFor="recipe-yield-unit"
                >
                  <Select
                    id="recipe-yield-unit"
                    value={yieldUnitId ?? ""}
                    onChange={(e) =>
                      setYieldUnitId(e.target.value === "" ? null : e.target.value)
                    }
                  >
                    <option value="">{t("yieldUnitPlaceholder")}</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field
                  label={t("preparationTimeLabel")}
                  htmlFor="recipe-prep-time"
                  error={errors.preparationTime}
                >
                  <Input
                    id="recipe-prep-time"
                    inputMode="numeric"
                    value={preparationTime}
                    onChange={(e) => setPreparationTime(e.target.value)}
                    placeholder={t("preparationTimePlaceholder")}
                  />
                </Field>
              </div>
            </fieldset>
          </Card>

          <Card className="space-y-4 p-5">
            <fieldset className="space-y-4">
              <legend className="text-sm font-semibold">{t("sectionOrder")}</legend>
              <Field
                label={t("sortOrderLabel")}
                htmlFor="recipe-sort-order"
                error={errors.sortOrder}
              >
                <Input
                  id="recipe-sort-order"
                  inputMode="numeric"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  placeholder={t("sortOrderPlaceholder")}
                  className="sm:max-w-40"
                />
              </Field>
            </fieldset>
          </Card>

          <Card className="space-y-4 p-5">
            <fieldset className="space-y-4 rounded-lg border border-[var(--color-border)] p-4">
              <legend className="px-1 text-sm font-medium">
                {t("translationsLabel")}
              </legend>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {t("translationHint")}
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(
                  [
                    ["en", t("localeEN")],
                    ["ar", t("localeAR")],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="space-y-3">
                    <p className="text-sm font-medium">{label}</p>
                    <Field label={t("nameLabel")} htmlFor={`t-${key}-name`}>
                      <Input
                        id={`t-${key}-name`}
                        value={localeValues(key, "name")}
                        onChange={(e) =>
                          setLocaleValue(key, "name", e.target.value)
                        }
                      />
                    </Field>
                    <Field
                      label={t("descriptionLabel")}
                      htmlFor={`t-${key}-desc`}
                    >
                      <Textarea
                        id={`t-${key}-desc`}
                        rows={2}
                        value={localeValues(key, "description")}
                        onChange={(e) =>
                          setLocaleValue(key, "description", e.target.value)
                        }
                      />
                    </Field>
                    <Field label={t("notesLabel")} htmlFor={`t-${key}-notes`}>
                      <Textarea
                        id={`t-${key}-notes`}
                        rows={2}
                        value={localeValues(key, "notes")}
                        onChange={(e) =>
                          setLocaleValue(key, "notes", e.target.value)
                        }
                      />
                    </Field>
                  </div>
                ))}
              </div>
            </fieldset>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => router.push(backHref)}>
              {tc("common.cancel")}
            </Button>
            <Button onClick={submit} loading={busy}>
              {tc("common.save")}
            </Button>
          </div>
        </div>
      ) : (
        <Card className="p-6 text-sm text-[var(--color-muted-foreground)]">
          {t("noProduct")}
        </Card>
      )}
    </div>
  );
}