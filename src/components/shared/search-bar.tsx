"use client";

import { forwardRef, type InputHTMLAttributes } from "react";
import { Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface SearchBarProps extends InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
  containerClassName?: string;
}

const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ className, containerClassName, onClear, placeholder, ...props }, ref) => {
    const t = useTranslations("common");
    return (
      <div className={cn("relative w-full", containerClassName)}>
        <Search
          className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]"
          aria-hidden
        />
        <input
          ref={ref}
          type="search"
          placeholder={placeholder ?? t("common.search")}
          className={cn(
            "h-11 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-surface)] ps-10 pe-9 text-sm text-[var(--color-foreground)] shadow-sm transition-colors placeholder:text-[var(--color-muted-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]",
            className
          )}
          {...props}
        />
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="absolute end-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
            aria-label={t("common.close")}
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>
    );
  }
);

SearchBar.displayName = "SearchBar";

export { SearchBar };
