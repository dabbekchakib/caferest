"use client";

import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/select";
import type { CategoryWithTranslations } from "@/lib/categories/types";
import { resolveCategoryName } from "@/lib/categories/translations";

export interface CategoryOptionEntry {
  id: string;
  path: string;
  depth: number;
}

interface ProductCategorySelectProps {
  entries: CategoryOptionEntry[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  id?: string;
  /** Label rendered for the row already assigned in edit mode (may be inactive). */
  includeLabel?: string | null;
}

/** Native select listing the category hierarchy as indented options. */
export function ProductCategorySelect({
  entries,
  value,
  onChange,
  disabled,
  id,
  includeLabel,
}: ProductCategorySelectProps) {
  const t = useTranslations("products");

  const selectedExists = value === null || entries.some((e) => e.id === value);

  return (
    <Select
      id={id}
      aria-label={t("form.categoryLabel")}
      value={!selectedExists ? "__include" : value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
    >
      <option value="">{t("form.categoryPlaceholder")}</option>
      {!selectedExists && includeLabel && value && (
        <option value={value}>{includeLabel}</option>
      )}
      {entries.map((entry) => {
        const indent = "\u00A0\u00A0".repeat(entry.depth);
        return (
          <option key={entry.id} value={entry.id}>
            {indent}
            {entry.path}
          </option>
        );
      })}
    </Select>
  );
}

/** Map an ordered tree to flat option entries (depth + breadcrumb path). */
export function toCategoryOptionEntries(
  categories: CategoryWithTranslations[],
  locale: string
): CategoryOptionEntry[] {
  const out: CategoryOptionEntry[] = [];
  const walk = (
    list: CategoryWithTranslations[],
    parentId: string | null,
    depth: number,
    prefix: string
  ) => {
    const children = list
      .filter((c) => c.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    for (const c of children) {
      const label = resolveCategoryName(c.name, c.translations, locale);
      const path = prefix === "" ? label : `${prefix} / ${label}`;
      out.push({ id: c.id, path, depth });
      walk(list, c.id, depth + 1, path);
    }
  };
  walk(categories, null, 0, "");
  return out;
}

/** Filter to active categories, keeping the currently bound row if inactive. */
export function activeCategoryOptions(
  categories: CategoryWithTranslations[],
  locale: string,
  currentId: string | null
): { entries: CategoryOptionEntry[]; includeLabel: string | null } {
  const available = categories.filter((c) => c.is_active);
  if (
    currentId &&
    !categories.some((c) => c.id === currentId && c.is_active)
  ) {
    const current = categories.find((c) => c.id === currentId);
    if (current) {
      const merged = [...available, current];
      return {
        entries: toCategoryOptionEntries(merged, locale),
        includeLabel: resolveCategoryName(current.name, current.translations, locale),
      };
    }
  }
  return {
    entries: toCategoryOptionEntries(available, locale),
    includeLabel: null,
  };
}