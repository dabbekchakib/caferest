"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/stores/use-toast-store";
import {
  createDiningAreaAction,
  updateDiningAreaAction,
} from "@/features/dining-areas/actions";
import type { DiningAreaWithTranslations } from "@/lib/tables/types";
import { slugify, isValidDiningSlug } from "@/lib/tables/translations";
import {
  DINING_AREA_ICONS,
  diningAreaIcon,
} from "@/lib/tables/icons";

interface DiningAreaFormProps {
  mode: "create" | "edit";
  area?: DiningAreaWithTranslations | null;
}

type LocaleValues = {
  name: string;
  description: string;
};

const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function DiningAreaForm({ mode, area }: DiningAreaFormProps) {
  const t = useTranslations("diningAreas");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const toast = useToast();
  const router = useRouter();

  const [name, setName] = useState(area?.name ?? "");
  const [slug, setSlug] = useState(area?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(area));
  const [description, setDescription] = useState(area?.description ?? "");
  const [color, setColor] = useState(area?.color ?? "");
  const [icon, setIcon] = useState<string | null>(area?.icon ?? null);
  const [sortOrder, setSortOrder] = useState(String(area?.sort_order ?? 10));
  const [isActive, setIsActive] = useState(area?.is_active ?? true);
  const [translations, setTranslations] = useState<{
    en: LocaleValues;
    ar: LocaleValues;
  }>({
    en: {
      name: area?.translations.en?.name ?? "",
      description: area?.translations.en?.description ?? "",
    },
    ar: {
      name: area?.translations.ar?.name ?? "",
      description: area?.translations.ar?.description ?? "",
    },
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function syncSlug(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function submit() {
    const errs: Record<string, string> = {};
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    if (trimmedName.length < 2) errs.name = tc("common.required");
    if (!isValidDiningSlug(trimmedSlug)) errs.slug = tc("common.invalid");
    if (color.trim() !== "" && !HEX_REGEX.test(color.trim()))
      errs.color = tc("common.invalid");
    if (errs.name || errs.slug || errs.color) {
      setErrors(errs);
      return;
    }

    const payload = {
      name: trimmedName,
      slug: trimmedSlug,
      description: description.trim() === "" ? null : description.trim(),
      color: color.trim() === "" ? null : color.trim(),
      icon,
      sortOrder: Math.max(0, Number.parseInt(sortOrder, 10) || 0),
      isActive,
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
    const result =
      mode === "create"
        ? await createDiningAreaAction(payload)
        : area
          ? await updateDiningAreaAction({ ...payload, diningAreaId: area.id })
          : null;
    if (!result) return;
    setBusy(false);

    if (result.ok) {
      toast.success({
        title: mode === "create" ? t("createSuccess") : t("updateSuccess"),
      });
      router.push("/dining-areas");
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
          { label: tn("diningAreas"), href: "/dining-areas" },
          { label: mode === "create" ? t("createTitle") : t("editTitle") },
        ]}
        actions={
          <Button variant="outline" onClick={() => router.push("/dining-areas")}>
            {tc("common.cancel")}
          </Button>
        }
      />

      <div className="max-w-3xl space-y-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label={t("form.name")}
            htmlFor="dining-area-name"
            required
            error={errors.name}
          >
            <Input
              id="dining-area-name"
              value={name}
              onChange={(e) => syncSlug(e.target.value)}
              placeholder={t("form.namePlaceholder")}
            />
          </Field>

          <Field
            label={t("form.slug")}
            htmlFor="dining-area-slug"
            required
            error={errors.slug}
          >
            <Input
              id="dining-area-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder={t("form.slugPlaceholder")}
            />
          </Field>
        </div>

        <Field label={t("form.description")} htmlFor="dining-area-description">
          <Textarea
            id="dining-area-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t("form.descriptionPlaceholder")}
            rows={3}
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label={t("form.icon")} htmlFor="dining-area-icon">
            <div className="flex flex-wrap gap-1.5">
              {DINING_AREA_ICONS.map((key) => {
                const Icon = diningAreaIcon(key);
                const selected = icon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setIcon(selected ? null : key)}
                    aria-pressed={selected}
                    className={[
                      "inline-flex size-10 items-center justify-center rounded-lg border transition-colors",
                      selected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                        : "border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]",
                    ].join(" ")}
                    aria-label={`${t("form.icon")} ${key}`}
                  >
                    <Icon className="size-5" aria-hidden />
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label={t("form.color")} htmlFor="dining-area-color" error={errors.color}>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label={t("form.color")}
                value={HEX_REGEX.test(color) ? color : "#4f46e5"}
                onChange={(e) => setColor(e.target.value)}
                className="size-11 shrink-0 cursor-pointer rounded-lg border border-[var(--color-input)] bg-[var(--color-surface)] p-1"
              />
              <Input
                id="dining-area-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder={t("form.colorPlaceholder")}
                className="max-w-44"
              />
            </div>
          </Field>

          <Field
            label={t("form.sortOrder")}
            htmlFor="dining-area-sort"
            error={errors.sortOrder}
          >
            <Input
              id="dining-area-sort"
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </Field>
        </div>

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
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/dining-areas")}>
          {tc("common.cancel")}
        </Button>
        <Button onClick={submit} loading={busy}>
          {tc("common.save")}
        </Button>
      </div>
    </div>
  );
}