"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SearchX } from "lucide-react";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { CATEGORY_ICON_NAMES, getCategoryIcon } from "@/lib/categories/icons";

interface CategoryIconPickerProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

/** Grid of Lucide icons. Stored value is the kebab-case icon name. */
export function CategoryIconPicker({ value, onChange }: CategoryIconPickerProps) {
  const t = useTranslations("categories");
  const [query, setQuery] = useState("");

  const filtered = CATEGORY_ICON_NAMES.filter((name) =>
    name.includes(query.trim().toLowerCase())
  );

  return (
    <Field label={t("form.icon")}>
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`${CATEGORY_ICON_NAMES.length} ${t("form.name").toLowerCase()}`}
        className="max-w-xs"
        aria-label={t("form.icon")}
      />
      <div
        role="radiogroup"
        aria-label={t("form.icon")}
        className="flex flex-wrap gap-1.5"
      >
        {filtered.map((name) => {
          const Icon = getCategoryIcon(name);
          const selected = value === name;
          return (
            <button
              key={name}
              type="button"
              role="radio"
              aria-checked={selected}
              title={name}
              onClick={() => onChange(selected ? null : name)}
              className={
                selected
                  ? "flex size-10 items-center justify-center rounded-lg border-2 border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                  : "flex size-10 items-center justify-center rounded-lg border border-[var(--color-input)] text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              }
            >
              <Icon className="size-5" aria-hidden />
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="flex items-center gap-2 py-2 text-sm text-[var(--color-muted-foreground)]">
            <SearchX className="size-4" aria-hidden />
            <span>{t("noResults")}</span>
          </div>
        )}
      </div>
    </Field>
  );
}