"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Trash2, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/stores/use-toast-store";
import {
  createCategoryAction,
  updateCategoryAction,
} from "@/features/categories/actions";
import {
  CategoryParentSelect,
  toParentPickerEntries,
} from "./category-parent-select";
import { CategoryIconPicker } from "./category-icon-picker";
import type { CategoryWithTranslations } from "@/lib/categories/types";
import { resolveCategoryName } from "@/lib/categories/translations";
import { collectSubtreeIds } from "@/lib/categories/tree";
import { slugify } from "@/lib/categories/slug";

interface CategoryFormProps {
  mode: "create" | "edit";
  category?: CategoryWithTranslations | null;
  allCategories: CategoryWithTranslations[];
  initialParentId?: string | null;
}

type LocaleValues = {
  name: string;
  description: string;
};

export function CategoryForm({
  mode,
  category,
  allCategories,
  initialParentId,
}: CategoryFormProps) {
  const t = useTranslations("categories");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();

  const readOnly = category?.is_system === true;

  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(category));
  const [parentId, setParentId] = useState<string | null>(
    category?.parent_id ?? initialParentId ?? null
  );
  const [icon, setIcon] = useState<string | null>(category?.icon ?? null);
  const [color, setColor] = useState(category?.color ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [isActive, setIsActive] = useState(category?.is_active ?? true);
  const [translations, setTranslations] = useState<{
    en: LocaleValues;
    ar: LocaleValues;
  }>({
    en: {
      name: category?.translations.en?.name ?? "",
      description: category?.translations.en?.description ?? "",
    },
    ar: {
      name: category?.translations.ar?.name ?? "",
      description: category?.translations.ar?.description ?? "",
    },
  });
  const [imageUrl, setImageUrl] = useState<string | null>(
    category?.image_url ?? null
  );
  const [image, setImage] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const excludeIds = useMemo(() => {
    if (!category) return new Set<string>();
    return collectSubtreeIds(allCategories, category.id);
  }, [category, allCategories]);

  const parentEntries = useMemo(
    () => toParentPickerEntries(allCategories, locale),
    [allCategories, locale]
  );

  const previewSrc = useMemo(() => {
    if (image) return URL.createObjectURL(image);
    return imageUrl && !removeImage ? imageUrl : null;
  }, [image, imageUrl, removeImage]);

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

  async function submit() {
    const errs: Record<string, string> = {};
    if (!name.trim() || name.trim().length < 2) errs.name = tc("common.required");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim()))
      errs.slug = tc("common.invalid");
    if (
      color.trim() !== "" &&
      !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(color.trim())
    )
      errs.color = tc("common.invalid");
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const payload = {
      name: name.trim(),
      slug: slug.trim(),
      description: description.trim() === "" ? null : description.trim(),
      parentId,
      icon,
      color: color.trim() === "" ? null : color.trim(),
      isActive,
      imageUrl: removeImage ? null : imageUrl,
      translations: {
        en: {
          name: translations.en.name.trim(),
          description:
            translations.en.description.trim() === ""
              ? null
              : translations.en.description.trim(),
        },
        ar: {
          name: translations.ar.name.trim(),
          description:
            translations.ar.description.trim() === ""
              ? null
              : translations.ar.description.trim(),
        },
      },
    };

    setBusy(true);
    const result = await (mode === "create"
      ? createCategoryAction(payload, image ?? null)
      : category
        ? updateCategoryAction(
            { ...payload, categoryId: category.id },
            image ?? null,
            removeImage
          )
        : null);
    if (!result) return;
    setBusy(false);

    if (result.ok) {
      toast.success({
        title: mode === "create" ? t("createSuccess") : t("updateSuccess"),
      });
      router.push("/categories");
      router.refresh();
    } else {
      toast.error({ title: tc("common.error"), description: tRoot(result.key) });
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={mode === "create" ? t("createTitle") : t("editTitle")}
        description={readOnly ? t("form.systemLocked") : t("description")}
        breadcrumbs={[
          { label: tn("categories"), href: "/categories" },
          { label: mode === "create" ? t("createTitle") : t("editTitle") },
        ]}
        actions={
          <Button variant="outline" onClick={() => router.push("/categories")}>
            {tc("common.cancel")}
          </Button>
        }
      />

      {readOnly && (
        <div className="flex items-center gap-2">
          <Badge variant="primary" size="sm">
            {t("form.systemBadge")}
          </Badge>
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {resolveCategoryName(category!.name, category!.translations, locale)}
          </span>
        </div>
      )}

      {!readOnly && (
        <div className="max-w-3xl space-y-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field
              label={t("form.name")}
              htmlFor="category-name"
              required
              error={errors.name}
            >
              <Input
                id="category-name"
                value={name}
                onChange={(e) => syncSlug(e.target.value)}
                placeholder={t("form.namePlaceholder")}
              />
            </Field>

            <Field
              label={t("form.slug")}
              htmlFor="category-slug"
              required
              error={errors.slug}
            >
              <Input
                id="category-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder={t("form.slugPlaceholder")}
              />
            </Field>
          </div>

          <Field label={t("form.parent")} htmlFor="category-parent">
            <CategoryParentSelect
              id="category-parent"
              entries={parentEntries}
              value={parentId}
              onChange={setParentId}
              excludeIds={excludeIds}
            />
          </Field>

          <CategoryIconPicker value={icon} onChange={setIcon} />

          <Field label={t("form.color")} htmlFor="category-color" error={errors.color}>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label={t("form.color")}
                value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#4f46e5"}
                onChange={(e) => setColor(e.target.value)}
                className="size-11 shrink-0 cursor-pointer rounded-lg border border-[var(--color-input)] bg-[var(--color-surface)] p-1"
              />
              <Input
                id="category-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder={t("form.colorPlaceholder")}
                className="max-w-44"
              />
            </div>
          </Field>

          <Field
            label={t("form.description")}
            htmlFor="category-description"
          >
            <Textarea
              id="category-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("form.descriptionPlaceholder")}
              rows={3}
            />
          </Field>

          <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] p-3">
            <div>
              <p className="text-sm font-medium">{t("form.isActive")}</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <fieldset className="space-y-4 rounded-lg border border-[var(--color-border)] p-4">
            <legend className="px-1 text-sm font-medium">
              {t("form.translations")}
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
                  <Field label={t("form.translationName")} htmlFor={`t-${key}-name`}>
                    <Input
                      id={`t-${key}-name`}
                      value={translations[key].name}
                      onChange={(e) =>
                        setTranslations((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], name: e.target.value },
                        }))
                      }
                    />
                  </Field>
                  <Field
                    label={t("form.translationDescription")}
                    htmlFor={`t-${key}-desc`}
                  >
                    <Textarea
                      id={`t-${key}-desc`}
                      rows={3}
                      value={translations[key].description}
                      onChange={(e) =>
                        setTranslations((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], description: e.target.value },
                        }))
                      }
                    />
                  </Field>
                </div>
              ))}
            </div>
          </fieldset>

          <Field label={t("form.image")} error={errors.image} helpText={t("form.imageHint")}>
            <div className="flex flex-wrap items-center gap-4">
              {previewSrc ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewSrc}
                    alt=""
                    className="size-24 rounded-lg border border-[var(--color-border)] object-cover"
                  />
                </div>
              ) : (
                <div className="flex size-24 items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] text-[var(--color-muted-foreground)]">
                  <Upload className="size-6" aria-hidden />
                </div>
              )}
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
                  {previewSrc ? t("form.imageReplace") : t("form.imageUpload")}
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
                    {t("form.imageRemove")}
                  </Button>
                )}
              </div>
            </div>
          </Field>
        </div>
      )}

      {!readOnly && (
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/categories")}>
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