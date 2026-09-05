"use client";

import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/select";
import type { CategoryWithTranslations } from "@/lib/categories/types";
import { resolveCategoryName } from "@/lib/categories/translations";

export interface ParentPickerEntry {
  id: string;
  path: string;
  depth: number;
}

interface CategoryParentSelectProps {
  /** Flat, ordered entries of the whole tree. */
  entries: ParentPickerEntry[];
  /** Rendered in the active UI locale (used only to sort/label "none"). */
  value: string | null;
  onChange: (value: string | null) => void;
  /** Categories that must not be selectable (self + descendants). */
  excludeIds?: Set<string>;
  disabled?: boolean;
  id?: string;
  required?: boolean;
}

/**
 * Native select listing the category hierarchy as indented options.
 * `value=""` means "no parent" (root category).
 */
export function CategoryParentSelect({
  entries,
  value,
  onChange,
  excludeIds,
  disabled,
  id,
  required,
}: CategoryParentSelectProps) {
  const t = useTranslations("categories");

  return (
    <Select
      id={id}
      aria-label={t("parentPicker.title")}
      value={value ?? ""}
      disabled={disabled}
      required={required}
      onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
    >
      <option value="">{t("form.noParent")}</option>
      {entries.map((entry) => {
        if (excludeIds?.has(entry.id)) return null;
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

export { resolveCategoryName };

/** Map a tree to option entries (depth + breadcrumb path). */
export function toParentPickerEntries(
  categories: CategoryWithTranslations[],
  locale: string
): ParentPickerEntry[] {
  const out: ParentPickerEntry[] = [];
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