"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { searchRecipeSelectorEntriesAction } from "@/features/recipes/actions";
import type { RecipeSelectorEntry } from "@/lib/recipes/types";

interface SubRecipeSelectorProps {
  value: RecipeSelectorEntry | null;
  onChange: (entry: RecipeSelectorEntry | null) => void;
  label?: string;
  placeholder?: string;
  excludingRecipeId?: string;
  disabled?: boolean;
}

export function SubRecipeSelector({
  value,
  onChange,
  label,
  placeholder,
  excludingRecipeId,
  disabled,
}: SubRecipeSelectorProps) {
  const t = useTranslations("recipeBuilder");
  const [query, setQuery] = useState(value?.name ?? "");
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<RecipeSelectorEntry[]>([]);
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
        const result = await searchRecipeSelectorEntriesAction({
          query: q.length >= 2 ? q : undefined,
          excludingRecipeId,
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
  }, [query, excludingRecipeId, value]);

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
        placeholder={placeholder ?? t("addSubRecipe")}
        className="ps-9"
        aria-expanded={opened}
      />
      {opened && focused && results.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg">
          {!busy &&
            results.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(entry);
                    setOpened(false);
                    setQuery(entry.name);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {entry.name}
                    {entry.productName && (
                      <span className="ms-1 text-[var(--color-muted-foreground)]">
                        — {entry.productName}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <Badge variant="muted" size="sm">
                      v{entry.version}
                    </Badge>
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
