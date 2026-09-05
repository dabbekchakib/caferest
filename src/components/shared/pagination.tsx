"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

function range(start: number, end: number): number[] {
  const r: number[] = [];
  for (let i = start; i <= end; i++) r.push(i);
  return r;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  className,
}: PaginationProps) {
  const t = useTranslations("common");
  const visiblePages = (() => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) return range(1, totalPages);
    if (page <= 4) {
      pages.push(...range(1, 5), "...", totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1, "...", ...range(totalPages - 4, totalPages));
    } else {
      pages.push(1, "...", page - 1, page, page + 1, "...", totalPages);
    }
    return pages;
  })();

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 sm:flex-row sm:justify-between",
        className
      )}
    >
      {totalItems !== undefined && pageSize !== undefined && (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t("pagination.showing", {
            from: (page - 1) * pageSize + 1,
            to: Math.min(page * pageSize, totalItems),
            total: totalItems,
          })}
        </p>
      )}
      <nav
        aria-label={t("pagination.label")}
        className="flex items-center gap-1"
      >
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex size-9 items-center justify-center rounded-lg text-sm text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:pointer-events-none disabled:opacity-40"
          aria-label={t("pagination.previous")}
        >
          <ChevronLeft className="size-4 rtl:rotate-180" aria-hidden />
        </button>
        {visiblePages.map((p, i) =>
          p === "..." ? (
            <span
              key={`dot-${i}`}
              className="px-1 text-sm text-[var(--color-muted-foreground)]"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "size-9 rounded-lg text-sm font-medium transition-colors",
                p === page
                  ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                  : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex size-9 items-center justify-center rounded-lg text-sm text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] disabled:pointer-events-none disabled:opacity-40"
          aria-label={t("pagination.next")}
        >
          <ChevronRight className="size-4 rtl:rotate-180" aria-hidden />
        </button>
      </nav>
    </div>
  );
}
