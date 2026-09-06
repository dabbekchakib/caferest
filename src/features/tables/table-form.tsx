"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/stores/use-toast-store";
import {
  createTableAction,
  updateTableAction,
} from "@/features/tables/actions";
import type { DiningTableListItem } from "@/lib/tables/types";
import { slugify, isValidDiningSlug } from "@/lib/tables/translations";
import {
  DINING_TABLE_SHAPES,
  DINING_TABLE_STATUSES,
  TABLE_STATUS_LABEL_KEYS,
  TABLE_SHAPE_LABEL_KEYS,
  TABLE_DEFAULT_WIDTH,
  TABLE_DEFAULT_HEIGHT,
} from "@/lib/tables/status";
import { FLOOR_PLAN_SIZE } from "@/lib/floor-plan/geometry";

interface TableFormProps {
  mode: "create" | "edit";
  table?: DiningTableListItem | null;
  areas: Array<{ id: string; name: string }>;
}

const HEX_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SINGLE_HEX_REGEX = /^#([0-9a-fA-F]{6})$/;

function toHex(value: string): string {
  if (SINGLE_HEX_REGEX.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    return (
      "#" +
      value
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
    );
  }
  return "";
}

export function TableForm({ mode, table, areas }: TableFormProps) {
  const t = useTranslations("tables");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const toast = useToast();
  const router = useRouter();

  const [name, setName] = useState(table?.name ?? "");
  const [slug, setSlug] = useState(table?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(table));
  const [tableNumber, setTableNumber] = useState(table?.table_number ?? "");
  const [areaId, setAreaId] = useState<string>(table?.area_id ?? "");
  const [capacity, setCapacity] = useState(String(table?.capacity ?? 1));
  const [shape, setShape] = useState(table?.shape ?? "round");
  const [positionX, setPositionX] = useState(
    String(table?.position_x ?? 0)
  );
  const [positionY, setPositionY] = useState(
    String(table?.position_y ?? 0)
  );
  const [width, setWidth] = useState(
    String(table?.width ?? TABLE_DEFAULT_WIDTH)
  );
  const [height, setHeight] = useState(
    String(table?.height ?? TABLE_DEFAULT_HEIGHT)
  );
  const [rotation, setRotation] = useState(String(table?.rotation ?? 0));
  const [color, setColor] = useState(table?.color ?? "#4f46e5");
  const [sortOrder, setSortOrder] = useState(String(table?.sort_order ?? 0));
  const [status, setStatus] = useState(table?.status ?? "available");
  const [isActive, setIsActive] = useState(table?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function syncSlug(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function parseNumber(value: string, fallback: number): number {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  async function submit() {
    const errs: Record<string, string> = {};
    const trimmedName = name.trim();
    const trimmedSlug = slug.trim();
    if (!trimmedName) errs.name = tc("common.required");
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
      tableNumber: tableNumber.trim() || null,
      areaId: areaId || null,
      capacity: Math.max(1, Math.round(parseNumber(capacity, 1))),
      shape,
      positionX: parseNumber(positionX, 0),
      positionY: parseNumber(positionY, 0),
      width: Math.min(FLOOR_PLAN_SIZE, parseNumber(width, TABLE_DEFAULT_WIDTH)),
      height: Math.min(
        FLOOR_PLAN_SIZE,
        parseNumber(height, TABLE_DEFAULT_HEIGHT)
      ),
      rotation: Math.min(360, Math.max(0, parseNumber(rotation, 0))),
      color: color.trim().startsWith("#") ? color.trim() : toHex(color.trim()),
      sortOrder: Math.max(0, Math.round(parseNumber(sortOrder, 0))),
      status,
      isActive,
    };

    setBusy(true);
    const result =
      mode === "create"
        ? await createTableAction(payload)
        : table
          ? await updateTableAction({ ...payload, tableId: table.id })
          : null;
    if (!result) return;
    setBusy(false);

    if (result.ok) {
      toast.success({
        title: mode === "create" ? t("createSuccess") : t("updateSuccess"),
      });
      router.push("/tables");
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
          { label: tn("tables"), href: "/tables" },
          { label: mode === "create" ? t("createTitle") : t("editTitle") },
        ]}
        actions={
          <Button variant="outline" onClick={() => router.push("/tables")}>
            {tc("common.cancel")}
          </Button>
        }
      />

      <div className="max-w-3xl space-y-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field
            label={t("form.name")}
            htmlFor="table-name"
            required
            error={errors.name}
          >
            <Input
              id="table-name"
              value={name}
              onChange={(e) => syncSlug(e.target.value)}
              placeholder={t("form.namePlaceholder")}
            />
          </Field>

          <Field
            label={t("form.slug")}
            htmlFor="table-slug"
            required
            error={errors.slug}
          >
            <Input
              id="table-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder={t("form.slugPlaceholder")}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label={t("form.tableNumber")} htmlFor="table-number">
            <Input
              id="table-number"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              placeholder={t("form.tableNumberPlaceholder")}
            />
          </Field>

          <Field label={t("form.area")} htmlFor="table-area">
            <Select
              id="table-area"
              aria-label={t("form.area")}
              value={areaId}
              onChange={(e) => setAreaId(e.target.value)}
            >
              <option value="">{t("form.areaNone")}</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label={t("form.capacity")}
            htmlFor="table-capacity"
            error={errors.capacity}
          >
            <Input
              id="table-capacity"
              type="number"
              min={1}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label={t("form.shape")} htmlFor="table-shape">
            <Select
              id="table-shape"
              aria-label={t("form.shape")}
              value={shape}
              onChange={(e) => setShape(e.target.value as (typeof DINING_TABLE_SHAPES)[number])}
            >
              {DINING_TABLE_SHAPES.map((s) => (
                <option key={s} value={s}>
                  {t(TABLE_SHAPE_LABEL_KEYS[s])}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t("form.status")} htmlFor="table-status">
            <Select
              id="table-status"
              aria-label={t("form.status")}
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as (typeof DINING_TABLE_STATUSES)[number])
              }
            >
              {DINING_TABLE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(TABLE_STATUS_LABEL_KEYS[s])}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <Field label={t("form.positionX")} htmlFor="table-pos-x">
            <Input
              id="table-pos-x"
              type="number"
              value={positionX}
              onChange={(e) => setPositionX(e.target.value)}
            />
          </Field>
          <Field label={t("form.positionY")} htmlFor="table-pos-y">
            <Input
              id="table-pos-y"
              type="number"
              value={positionY}
              onChange={(e) => setPositionY(e.target.value)}
            />
          </Field>
          <Field label={t("form.width")} htmlFor="table-width">
            <Input
              id="table-width"
              type="number"
              min={50}
              value={width}
              onChange={(e) => setWidth(e.target.value)}
            />
          </Field>
          <Field label={t("form.height")} htmlFor="table-height">
            <Input
              id="table-height"
              type="number"
              min={50}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <Field label={t("form.rotation")} htmlFor="table-rotation">
            <Input
              id="table-rotation"
              type="number"
              min={0}
              max={360}
              value={rotation}
              onChange={(e) => setRotation(e.target.value)}
            />
          </Field>

          <Field label={t("form.color")} htmlFor="table-color" error={errors.color}>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label={t("form.color")}
                value={SINGLE_HEX_REGEX.test(color) ? color : "#4f46e5"}
                onChange={(e) => setColor(e.target.value)}
                className="size-11 shrink-0 cursor-pointer rounded-lg border border-[var(--color-input)] bg-[var(--color-surface)] p-1"
              />
              <Input
                id="table-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder={t("form.colorPlaceholder")}
                className="max-w-44"
              />
            </div>
          </Field>

          <Field label={t("form.sortOrder")} htmlFor="table-sort">
            <Input
              id="table-sort"
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
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.push("/tables")}>
          {tc("common.cancel")}
        </Button>
        <Button onClick={submit} loading={busy}>
          {tc("common.save")}
        </Button>
      </div>
    </div>
  );
}