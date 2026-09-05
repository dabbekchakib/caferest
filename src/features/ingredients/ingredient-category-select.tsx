"use client";

import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/select";
import type { CategoryWithTranslations } from "@/lib/categories/types";
import type { CategoryOptionEntry } from "@/features/products/product-category-select";
import {
  activeCategoryOptions,
  toCategoryOptionEntries,
} from "@/features/products/product-category-select";

export type { CategoryOptionEntry };

interface IngredientCategorySelectProps {
  entries: CategoryOptionEntry[];
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  id?: string;
  /** Label rendered for the row already assigned in edit mode (may be inactive). */
  includeLabel?: string | null;
}

/** Native select listing the category hierarchy as indented options. */
export function IngredientCategorySelect({
  entries,
  value,
  onChange,
  disabled,
  id,
  includeLabel,
}: IngredientCategorySelectProps) {
  const t = useTranslations("ingredients");

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

/** Re-export the tree → flat option helpers bound to the ingredient namespace. */
export { toCategoryOptionEntries };

export function ingredientCategoryOptions(
  categories: CategoryWithTranslations[],
  locale: string,
  currentId: string | null
): { entries: CategoryOptionEntry[]; includeLabel: string | null } {
  return activeCategoryOptions(categories, locale, currentId);
}