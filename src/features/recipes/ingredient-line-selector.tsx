"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchIngredientsAction } from "@/features/ingredients/actions";
import type { IngredientSelectorEntry } from "@/lib/ingredients/types";

interface IngredientLineSelectorProps {
  value: IngredientSelectorEntry | null;
  onChange: (entry: IngredientSelectorEntry | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function IngredientLineSelector({
  value,
  onChange,
  label,
  placeholder,
  disabled,
}: IngredientLineSelectorProps) {
  const t = useTranslations("recipeBuilder");
  const [query, setQuery] = useState(value?.name ?? "");
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<IngredientSelectorEntry[]>([]);
  const [opened, setOpened] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    timer.current = setTimeout(
      async () => {
        if (q.length < 2 && !value) {
          setResults([]);
          return;
        }
        setBusy(true);
        const result = await searchIngredientsAction({
          query: q.length >= 2 ? q : "",
          limit: 20,
        });
        setBusy(false);
        if (result.ok) {
          setResults(result.data);
          setOpened(true);
        }
      },
      q.length < 2 ? 0 : 300
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, value]);

  return (
    <div className="relative">
      {label && (
        <label className="mb-1 block text-sm font-medium text-[var(--color-foreground)]">
          {label}
        </label>
      )}
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)] rtl:left-auto rtl:right-3"
        aria-hidden
      />
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          if (value) onChange(null);
        }}
        onFocus={() => {
          setFocused(true);
          if (results.length > 0) setOpened(true);
        }}
        onBlur={() => {
          setFocused(false);
          setTimeout(() => setOpened(false), 150);
        }}
        disabled={disabled}
        placeholder={placeholder ?? t("addIngredient")}
        className="ps-9"
        aria-expanded={opened}
      />
      {opened && focused && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg">
          {!busy &&
            results.map((ingredient) => (
              <li key={ingredient.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(ingredient);
                    setOpened(false);
                    setQuery(ingredient.name);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
                >
                  <span className="truncate">
                    {ingredient.name}
                    {ingredient.baseUnitSymbol && (
                      <span className="ms-1 text-[var(--color-muted-foreground)]">
                        — {ingredient.baseUnitSymbol}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}