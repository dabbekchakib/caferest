"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/stores/use-toast-store";
import {
  createIngredientAction,
  updateIngredientAction,
} from "@/features/ingredients/actions";
import { ingredientCategoryOptions } from "./ingredient-category-select";
import { IngredientCategorySelect } from "./ingredient-category-select";
import { IngredientImage } from "./ingredient-image";
import { parseDecimal } from "@/lib/ingredients/formatters";
import { slugify } from "@/lib/ingredients/slug";
import { calculateIngredientCostPerBaseUnit } from "@/lib/ingredients/cost";
import { INGREDIENT_TYPES, type IngredientType } from "@/lib/ingredients/types";
import { formatCost } from "@/lib/ingredients/formatters";
import type { IngredientWithTranslations } from "@/lib/ingredients/types";
import type { CategoryWithTranslations } from "@/lib/categories/types";
import type { Unit, UnitConversion } from "@/lib/units/types";

interface IngredientFormProps {
  mode: "create" | "edit";
  ingredient?: IngredientWithTranslations | null;
  categories: CategoryWithTranslations[];
  units: Unit[];
  conversions: UnitConversion[];
}

type LocaleValues = {
  name: string;
  description: string;
};

export function IngredientForm({
  mode,
  ingredient,
  categories,
  units,
  conversions,
}: IngredientFormProps) {
  const t = useTranslations("ingredients");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();

  const readOnly = ingredient?.is_system === true;

  const [name, setName] = useState(ingredient?.name ?? "");
  const [description, setDescription] = useState(ingredient?.description ?? "");
  const [slug, setSlug] = useState(ingredient?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(ingredient));
  const [ingredientType, setIngredientType] = useState<IngredientType>(
    ingredient?.ingredient_type ?? "raw_material"
  );
  const [categoryId, setCategoryId] = useState<string | null>(
    ingredient?.category_id ?? null
  );
  const [baseUnitId, setBaseUnitId] = useState<string | null>(
    ingredient?.base_unit_id ?? null
  );
  const [purchaseUnitId, setPurchaseUnitId] = useState<string | null>(
    ingredient?.purchase_unit_id ?? null
  );
  const [purchaseQuantity, setPurchaseQuantity] = useState(
    ingredient?.purchase_quantity != null
      ? String(ingredient.purchase_quantity)
      : ""
  );
  const [purchaseCost, setPurchaseCost] = useState(
    ingredient?.purchase_cost != null && ingredient.purchase_cost > 0
      ? String(ingredient.purchase_cost)
      : ""
  );
  const [wastePercentage, setWastePercentage] = useState(
    ingredient?.waste_percentage != null && ingredient.waste_percentage > 0
      ? String(ingredient.waste_percentage)
      : ""
  );
  const [sku, setSku] = useState(ingredient?.sku ?? "");
  const [barcode, setBarcode] = useState(ingredient?.barcode ?? "");
  const [isActive, setIsActive] = useState(ingredient?.is_active ?? true);
  const [isStockTracked, setIsStockTracked] = useState(
    ingredient?.is_stock_tracked ?? true
  );
  const [sortOrder, setSortOrder] = useState(
    ingredient?.sort_order != null ? String(ingredient.sort_order) : ""
  );
  const [translations, setTranslations] = useState<{
    en: LocaleValues;
    ar: LocaleValues;
  }>({
    en: {
      name: ingredient?.translations.en?.name ?? "",
      description: ingredient?.translations.en?.description ?? "",
    },
    ar: {
      name: ingredient?.translations.ar?.name ?? "",
      description: ingredient?.translations.ar?.description ?? "",
    },
  });
  const [imageUrl, setImageUrl] = useState<string | null>(
    ingredient?.image_url ?? null
  );
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const categoryOptions = useMemo(
    () =>
      ingredientCategoryOptions(categories, locale, ingredient?.category_id ?? null),
    [categories, locale, ingredient]
  );

  const previewSrc = useMemo(() => {
    if (image) return URL.createObjectURL(image);
    return imageUrl && !removeImage ? imageUrl : null;
  }, [image, imageUrl, removeImage]);

  const costPreview = useMemo(() => {
    const costValue = parseDecimal(purchaseCost);
    const quantityValue = parseDecimal(purchaseQuantity);
    if (costValue === null || quantityValue === null) return null;
    if (!purchaseUnitId || !baseUnitId) return null;
    return calculateIngredientCostPerBaseUnit({
      purchaseCost: costValue,
      purchaseQuantity: quantityValue,
      purchaseUnitId,
      baseUnitId,
      conversions,
    });
  }, [purchaseCost, purchaseQuantity, purchaseUnitId, baseUnitId, conversions]);

  const baseUnitSymbol =
    units.find((u) => u.id === baseUnitId)?.symbol ?? null;

  function syncSlug(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function handleImageSelect(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, image: t("form.imageTooLarge") }));
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrors((prev) => ({ ...prev, image: t("form.imageBadType") }));
      return;
    }
    setErrors((prev) => ({ ...prev, image: "" }));
    setRemoveImage(false);
    setImage(file);
  }

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
    if (!name.trim() || name.trim().length < 2) errs.name = tc("common.required");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim()))
      errs.slug = tc("common.invalid");

    const quantityValue = parseDecimal(purchaseQuantity);
    if (quantityValue === null || quantityValue <= 0)
      errs.purchaseQuantity = tc("common.invalid");
    const costValue = parseDecimal(purchaseCost);
    if (costValue === null || costValue < 0) errs.purchaseCost = tc("common.invalid");

    const wasteValue = parseDecimal(wastePercentage);
    if (
      wasteValue !== null &&
      (!Number.isInteger(wasteValue) || wasteValue < 0 || wasteValue > 100)
    )
      errs.wastePercentage = tc("common.invalid");

    const sortValue = sortOrder.trim() === "" ? undefined : Number(sortOrder);
    if (
      sortValue !== undefined &&
      (!Number.isInteger(sortValue) || sortValue < 0)
    )
      errs.sortOrder = tc("common.invalid");

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const clean = (value: string) => (value.trim() === "" ? null : value.trim());

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      description: clean(description),
      ingredientType,
      categoryId,
      baseUnitId,
      purchaseUnitId,
      purchaseQuantity: quantityValue ?? 1,
      purchaseCost: costValue ?? 0,
      wastePercentage: wasteValue ?? 0,
      sku: clean(sku),
      barcode: clean(barcode),
      isActive,
      isStockTracked,
      sortOrder: sortValue,
      imageUrl: removeImage ? null : imageUrl,
      translations: {
        en: {
          name: translations.en.name.trim(),
          description: clean(translations.en.description),
        },
        ar: {
          name: translations.ar.name.trim(),
          description: clean(translations.ar.description),
        },
      },
    };

    setBusy(true);
    const result = await (mode === "create"
      ? createIngredientAction(payload, image ?? null)
      : ingredient
        ? updateIngredientAction(
            { ...payload, ingredientId: ingredient.id },
            image ?? null,
            removeImage
          )
        : null);
    if (!result) return;
    setBusy(false);

    if (result.ok) {
      toast.success({
        title: mode === "create" ? t("success.created") : t("success.updated"),
      });
      router.push(mode === "edit" && ingredient ? `/ingredients/${ingredient.id}` : "/ingredients");
      router.refresh();
    } else {
      toast.error({ title: tc("common.error"), description: tRoot(result.key) });
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={mode === "create" ? t("createTitle") : t("editTitle")}
        description={t("description")}
        breadcrumbs={[
          { label: tn("ingredients"), href: "/ingredients" },
          { label: mode === "create" ? t("createTitle") : t("editTitle") },
        ]}
        actions={
          <Button variant="outline" onClick={() => router.push("/ingredients")}>
            {tc("common.cancel")}
          </Button>
        }
      />

      {!readOnly && (
        <div className="max-w-3xl space-y-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm">
          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">
              {t("form.sectionGeneral")}
            </legend>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label={t("form.nameLabel")}
                htmlFor="ingredient-name"
                required
                error={errors.name}
              >
                <Input
                  id="ingredient-name"
                  value={name}
                  onChange={(e) => syncSlug(e.target.value)}
                  placeholder={t("form.namePlaceholder")}
                />
              </Field>
              <Field
                label={t("form.slugLabel")}
                htmlFor="ingredient-slug"
                required
                error={errors.slug}
              >
                <Input
                  id="ingredient-slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                  placeholder={t("form.slugPlaceholder")}
                />
              </Field>
            </div>
            <Field
              label={t("form.descriptionLabel")}
              htmlFor="ingredient-description"
            >
              <Textarea
                id="ingredient-description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("form.descriptionPlaceholder")}
              />
            </Field>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">
              {t("form.sectionClassification")}
            </legend>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label={t("form.typeLabel")}
                htmlFor="ingredient-type"
                required
              >
                <select
                  id="ingredient-type"
                  value={ingredientType}
                  onChange={(e) =>
                    setIngredientType(e.target.value as IngredientType)
                  }
                  className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                >
                  {INGREDIENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`types.${type}`)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("form.categoryLabel")} htmlFor="ingredient-category">
                <IngredientCategorySelect
                  id="ingredient-category"
                  entries={categoryOptions.entries}
                  includeLabel={categoryOptions.includeLabel}
                  value={categoryId}
                  onChange={setCategoryId}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">
              {t("form.sectionPurchase")}
            </legend>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label={t("form.baseUnitLabel")}
                htmlFor="ingredient-base-unit"
              >
                <select
                  id="ingredient-base-unit"
                  value={baseUnitId ?? ""}
                  onChange={(e) =>
                    setBaseUnitId(e.target.value === "" ? null : e.target.value)
                  }
                  className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                >
                  <option value="">{t("form.baseUnitPlaceholder")}</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.symbol})
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={t("form.purchaseUnitLabel")}
                htmlFor="ingredient-purchase-unit"
              >
                <select
                  id="ingredient-purchase-unit"
                  value={purchaseUnitId ?? ""}
                  onChange={(e) =>
                    setPurchaseUnitId(e.target.value === "" ? null : e.target.value)
                  }
                  className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                >
                  <option value="">{t("form.purchaseUnitPlaceholder")}</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.symbol})
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={t("form.purchaseQuantityLabel")}
                htmlFor="ingredient-purchase-qty"
                required
                error={errors.purchaseQuantity}
              >
                <Input
                  id="ingredient-purchase-qty"
                  inputMode="decimal"
                  value={purchaseQuantity}
                  onChange={(e) => setPurchaseQuantity(e.target.value)}
                  placeholder={t("form.purchaseQuantityPlaceholder")}
                />
              </Field>
              <Field
                label={t("form.purchaseCostLabel")}
                htmlFor="ingredient-purchase-cost"
                required
                error={errors.purchaseCost}
                helpText={t("form.purchaseHint")}
              >
                <Input
                  id="ingredient-purchase-cost"
                  inputMode="decimal"
                  value={purchaseCost}
                  onChange={(e) => setPurchaseCost(e.target.value)}
                  placeholder={t("form.purchaseCostPlaceholder")}
                />
              </Field>
              <Field
                label={t("form.wasteLabel")}
                htmlFor="ingredient-waste"
                error={errors.wastePercentage}
                helpText={t("form.wasteHint")}
              >
                <Input
                  id="ingredient-waste"
                  inputMode="numeric"
                  value={wastePercentage}
                  onChange={(e) => setWastePercentage(e.target.value)}
                  placeholder={t("form.wastePlaceholder")}
                />
              </Field>
            </div>
            {costPreview !== null && baseUnitSymbol && (
              <p className="text-sm">
                <span className="text-[var(--color-muted-foreground)]">
                  {t("form.costPerBaseUnitLabel")} →
                </span>{" "}
                <span className="font-semibold">
                  {formatCost(costPreview, locale)} TND / {baseUnitSymbol}
                </span>
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">
              {t("form.sectionIdentification")}
            </legend>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label={t("form.skuLabel")} htmlFor="ingredient-sku">
                <Input
                  id="ingredient-sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder={t("form.skuPlaceholder")}
                />
              </Field>
              <Field
                label={t("form.barcodeLabel")}
                htmlFor="ingredient-barcode"
              >
                <Input
                  id="ingredient-barcode"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder={t("form.barcodePlaceholder")}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">
              {t("form.sectionImage")}
            </legend>
            <Field
              label={t("form.imageLabel")}
              error={errors.image}
              helpText={t("form.imageHint")}
            >
              <div className="flex flex-wrap items-center gap-4">
                <IngredientImage
                  src={previewSrc}
                  alt={name || t("form.noImage")}
                  className="size-24"
                />
                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleImageSelect(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="size-4" aria-hidden />
                    {previewSrc ? t("form.changeImage") : t("form.imageLabel")}
                  </Button>
                  {previewSrc && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setImage(null);
                        setImageUrl(null);
                        setRemoveImage(true);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                      {t("form.removeImage")}
                    </Button>
                  )}
                </div>
              </div>
            </Field>
          </fieldset>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">
              {t("form.sectionAvailability")}
            </legend>
            {[
              ["isActive", t("form.activeLabel"), t("form.activeHint")],
              ["isStockTracked", t("form.stockLabel"), t("form.stockHint")],
            ].map(([key, label, hint]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] p-3"
              >
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {hint}
                  </p>
                </div>
                <Switch
                  checked={key === "isStockTracked" ? isStockTracked : isActive}
                  onCheckedChange={(checked) =>
                    key === "isStockTracked"
                      ? setIsStockTracked(checked)
                      : setIsActive(checked)
                  }
                />
              </div>
            ))}
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">
              {t("form.sectionOrder")}
            </legend>
            <Field
              label={t("form.sortOrderLabel")}
              htmlFor="ingredient-sort"
              error={errors.sortOrder}
            >
              <Input
                id="ingredient-sort"
                inputMode="numeric"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder={t("form.sortOrderPlaceholder")}
                className="sm:max-w-40"
              />
            </Field>
          </fieldset>

          <fieldset className="space-y-4 rounded-lg border border-[var(--color-border)] p-4">
            <legend className="px-1 text-sm font-medium">
              {t("form.translationsLabel")}
            </legend>
            <p className="text-xs text-[var(--color-muted-foreground)]">
              {t("form.translationHint")}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  ["en", t("form.localeEN")],
                  ["ar", t("form.localeAR")],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-3">
                  <p className="text-sm font-medium">{label}</p>
                  <Field label={t("form.nameLabel")} htmlFor={`t-${key}-name`}>
                    <Input
                      id={`t-${key}-name`}
                      value={localeValues(key, "name")}
                      onChange={(e) => setLocaleValue(key, "name", e.target.value)}
                    />
                  </Field>
                  <Field
                    label={t("form.descriptionLabel")}
                    htmlFor={`t-${key}-desc`}
                  >
                    <Textarea
                      id={`t-${key}-desc`}
                      rows={3}
                      value={localeValues(key, "description")}
                      onChange={(e) =>
                        setLocaleValue(key, "description", e.target.value)
                      }
                    />
                  </Field>
                </div>
              ))}
            </div>
          </fieldset>
        </div>
      )}

      {!readOnly && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/ingredients")}>
            {tc("common.cancel")}
          </Button>
          <Button onClick={submit} loading={busy}>
            {tc("common.save")}
          </Button>
        </div>
      )}
    </div>
  );
}