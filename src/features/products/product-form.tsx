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
  createProductAction,
  updateProductAction,
} from "@/features/products/actions";
import {
  ProductCategorySelect,
  activeCategoryOptions,
} from "./product-category-select";
import { ProductImage } from "./product-image";
import { parseDecimal } from "@/lib/products/formatters";
import { slugify } from "@/lib/products/slug";
import type { ProductWithTranslations } from "@/lib/products/types";
import type { CategoryWithTranslations } from "@/lib/categories/types";
import type { Unit } from "@/lib/units/types";

export interface ProductTaxOption {
  id: string;
  name: string;
  rate: number;
}

interface ProductFormProps {
  mode: "create" | "edit";
  product?: ProductWithTranslations | null;
  categories: CategoryWithTranslations[];
  units: Unit[];
  taxes: ProductTaxOption[];
}

type LocaleValues = {
  name: string;
  shortDescription: string;
  description: string;
};

export function ProductForm({
  mode,
  product,
  categories,
  units,
  taxes,
}: ProductFormProps) {
  const t = useTranslations("products");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();

  const readOnly = product?.is_system === true;

  const [name, setName] = useState(product?.name ?? "");
  const [shortDescription, setShortDescription] = useState(
    product?.short_description ?? ""
  );
  const [description, setDescription] = useState(product?.description ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [productType, setProductType] = useState<
    "product" | "composite" | "service"
  >(product?.product_type ?? "product");
  const [categoryId, setCategoryId] = useState<string | null>(
    product?.category_id ?? null
  );
  const [unitId, setUnitId] = useState<string | null>(product?.unit_id ?? null);
  const [taxId, setTaxId] = useState<string | null>(product?.tax_id ?? null);
  const [price, setPrice] = useState(
    product?.price != null ? String(product.price) : ""
  );
  const [cost, setCost] = useState(
    product?.cost != null && product.cost > 0 ? String(product.cost) : ""
  );
  const [sku, setSku] = useState(product?.sku ?? "");
  const [barcode, setBarcode] = useState(product?.barcode ?? "");
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [isAvailable, setIsAvailable] = useState(
    product?.is_available ?? true
  );
  const [isPosEnabled, setIsPosEnabled] = useState(
    product?.is_pos_enabled ?? true
  );
  const [isStockTracked, setIsStockTracked] = useState(
    product?.is_stock_tracked ?? false
  );
  const [isFeatured, setIsFeatured] = useState(product?.is_featured ?? false);
  const [sortOrder, setSortOrder] = useState(
    product?.sort_order != null ? String(product.sort_order) : ""
  );
  const [translations, setTranslations] = useState<
    { en: LocaleValues; ar: LocaleValues }
  >({
    en: {
      name: product?.translations.en?.name ?? "",
      shortDescription: product?.translations.en?.shortDescription ?? "",
      description: product?.translations.en?.description ?? "",
    },
    ar: {
      name: product?.translations.ar?.name ?? "",
      shortDescription: product?.translations.ar?.shortDescription ?? "",
      description: product?.translations.ar?.description ?? "",
    },
  });
  const [imageUrl, setImageUrl] = useState<string | null>(
    product?.image_url ?? null
  );
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const categoryOptions = useMemo(
    () => activeCategoryOptions(categories, locale, product?.category_id ?? null),
    [categories, locale, product]
  );

  const previewSrc = useMemo(() => {
    if (image) return URL.createObjectURL(image);
    return imageUrl && !removeImage ? imageUrl : null;
  }, [image, imageUrl, removeImage]);

  const taxHasValue = (id: string | null) =>
    id === null || taxes.some((tax) => tax.id === id);

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

    const priceValue = parseDecimal(price);
    if (priceValue === null || priceValue < 0) errs.price = tc("common.invalid");
    const costValue = parseDecimal(cost);
    if (costValue !== null && costValue < 0) errs.cost = tc("common.invalid");

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
      shortDescription: clean(shortDescription),
      description: clean(description),
      productType,
      categoryId,
      unitId,
      taxId,
      price: priceValue ?? 0,
      cost: costValue ?? undefined,
      sku: clean(sku),
      barcode: clean(barcode),
      isActive,
      isAvailable,
      isPosEnabled,
      isStockTracked,
      isFeatured,
      sortOrder: sortValue,
      imageUrl: removeImage ? null : imageUrl,
      translations: {
        en: {
          name: translations.en.name.trim(),
          shortDescription: clean(translations.en.shortDescription),
          description: clean(translations.en.description),
        },
        ar: {
          name: translations.ar.name.trim(),
          shortDescription: clean(translations.ar.shortDescription),
          description: clean(translations.ar.description),
        },
      },
    };

    setBusy(true);
    const result = await (mode === "create"
      ? createProductAction(payload, image ?? null)
      : product
        ? updateProductAction(
            { ...payload, productId: product.id },
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
      router.push("/products");
      router.refresh();
    } else {
      toast.error({ title: tc("common.error"), description: tRoot(result.key) });
    }
  }

  const taxCurrentInvalid = !taxHasValue(taxId);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={mode === "create" ? t("createTitle") : t("editTitle")}
        description={t("description")}
        breadcrumbs={[
          { label: tn("products"), href: "/products" },
          { label: mode === "create" ? t("createTitle") : t("editTitle") },
        ]}
        actions={
          <Button variant="outline" onClick={() => router.push("/products")}>
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
                htmlFor="product-name"
                required
                error={errors.name}
              >
                <Input
                  id="product-name"
                  value={name}
                  onChange={(e) => syncSlug(e.target.value)}
                  placeholder={t("form.namePlaceholder")}
                />
              </Field>
              <Field
                label={t("form.slugLabel")}
                htmlFor="product-slug"
                required
                error={errors.slug}
              >
                <Input
                  id="product-slug"
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
              label={t("form.shortDescriptionLabel")}
              htmlFor="product-short"
            >
              <Input
                id="product-short"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder={t("form.shortDescriptionPlaceholder")}
              />
            </Field>
            <Field label={t("form.descriptionLabel")} htmlFor="product-description">
              <Textarea
                id="product-description"
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
                htmlFor="product-type"
                required
              >
                <select
                  id="product-type"
                  value={productType}
                  onChange={(e) =>
                    setProductType(
                      e.target.value as "product" | "composite" | "service"
                    )
                  }
                  className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                >
                  <option value="product">{t("types.product")}</option>
                  <option value="composite">{t("types.composite")}</option>
                  <option value="service">{t("types.service")}</option>
                </select>
              </Field>
              <Field label={t("form.categoryLabel")} htmlFor="product-category">
                <ProductCategorySelect
                  id="product-category"
                  entries={categoryOptions.entries}
                  includeLabel={categoryOptions.includeLabel}
                  value={categoryId}
                  onChange={setCategoryId}
                />
              </Field>
              <Field label={t("form.unitLabel")} htmlFor="product-unit">
                <select
                  id="product-unit"
                  value={unitId ?? ""}
                  onChange={(e) =>
                    setUnitId(e.target.value === "" ? null : e.target.value)
                  }
                  className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                >
                  <option value="">{t("form.unitPlaceholder")}</option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} ({unit.symbol})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("form.taxLabel")} htmlFor="product-tax">
                <select
                  id="product-tax"
                  value={taxId ?? ""}
                  onChange={(e) =>
                    setTaxId(e.target.value === "" ? null : e.target.value)
                  }
                  className="flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                >
                  <option value="">{t("form.taxPlaceholder")}</option>
                  {taxId && taxCurrentInvalid && (
                    <option value={taxId}>
                      {t("form.taxRateLabel", {
                        rate: taxes.find((tax) => tax.id === taxId)?.rate ?? "",
                      })}
                    </option>
                  )}
                  {taxes.map((tax) => (
                    <option key={tax.id} value={tax.id}>
                      {tax.name} · {t("form.taxRateLabel", { rate: tax.rate })}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">
              {t("form.sectionPricing")}
            </legend>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field
                label={t("form.priceLabel")}
                htmlFor="product-price"
                required
                error={errors.price}
              >
                <Input
                  id="product-price"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={t("form.pricePlaceholder")}
                />
              </Field>
              <Field
                label={t("form.costLabel")}
                htmlFor="product-cost"
                error={errors.cost}
                helpText={t("form.costHint")}
              >
                <Input
                  id="product-cost"
                  inputMode="decimal"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder={t("form.costPlaceholder")}
                />
              </Field>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-sm font-semibold">
              {t("form.sectionIdentification")}
            </legend>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label={t("form.skuLabel")} htmlFor="product-sku">
                <Input
                  id="product-sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder={t("form.skuPlaceholder")}
                />
              </Field>
              <Field label={t("form.barcodeLabel")} htmlFor="product-barcode">
                <Input
                  id="product-barcode"
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
            <Field label={t("form.imageLabel")} error={errors.image} helpText={t("form.imageHint")}>
              <div className="flex flex-wrap items-center gap-4">
                <ProductImage
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
              ["isAvailable", t("form.availableLabel"), t("form.availableHint")],
              ["isPosEnabled", t("form.posLabel"), t("form.posHint")],
              ["isFeatured", t("form.featuredLabel"), t("form.featuredHint")],
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
                  checked={
                    key === "isAvailable"
                      ? isAvailable
                      : key === "isPosEnabled"
                        ? isPosEnabled
                        : key === "isFeatured"
                          ? isFeatured
                          : key === "isStockTracked"
                            ? isStockTracked
                            : isActive
                  }
                  onCheckedChange={(checked) =>
                    key === "isAvailable"
                      ? setIsAvailable(checked)
                      : key === "isPosEnabled"
                        ? setIsPosEnabled(checked)
                        : key === "isFeatured"
                          ? setIsFeatured(checked)
                          : key === "isStockTracked"
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
              htmlFor="product-sort"
              error={errors.sortOrder}
            >
              <Input
                id="product-sort"
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
                    label={t("form.shortDescriptionLabel")}
                    htmlFor={`t-${key}-short`}
                  >
                    <Input
                      id={`t-${key}-short`}
                      value={localeValues(key, "shortDescription")}
                      onChange={(e) =>
                        setLocaleValue(key, "shortDescription", e.target.value)
                      }
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
          <Button variant="outline" onClick={() => router.push("/products")}>
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