"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchIngredientsAction } from "@/features/ingredients/actions";
import type { IngredientSelectorEntry } from "@/lib/ingredients/types";

interface IngredientSelectorProps {
  locale?: string;
  limit?: number;
  placeholder?: string;
  onSelect: (ingredient: IngredientSelectorEntry) => void;
  disabled?: boolean;
}

/** Debounced ingredient search with an inline results dropdown. */
export function IngredientSelector({
  locale = "fr",
  limit = 20,
  placeholder,
  onSelect,
  disabled,
}: IngredientSelectorProps) {
  const t = useTranslations("ingredients");
  const [query, setQuery] = useState("");
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
        if (q.length < 2) {
          setResults([]);
          return;
        }
        setBusy(true);
        const result = await searchIngredientsAction({ query: q, locale, limit });
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
  }, [query, locale, limit]);

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)] rtl:left-auto rtl:right-3"
        aria-hidden
      />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          setFocused(true);
          if (results.length > 0) setOpened(true);
        }}
        onBlur={() => {
          setFocused(false);
          setOpened(false);
        }}
        disabled={disabled}
        placeholder={placeholder ?? t("selector.placeholder")}
        className="ps-9"
        aria-expanded={opened}
        aria-label={t("selector.label")}
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
                    onSelect(ingredient);
                    setOpened(false);
                    setQuery(ingredient.name);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
                >
                  <span className="truncate">{ingredient.name}</span>
                  {ingredient.costPerBaseUnit !== null && (
                    <span className="shrink-0 font-medium">
                      {new Intl.NumberFormat(locale, {
                        style: "currency",
                        currency: "TND",
                      }).format(ingredient.costPerBaseUnit)}
                    </span>
                  )}
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}