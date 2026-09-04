import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FilterBarProps {
  children: ReactNode;
  className?: string;
  results?: string;
}

export function FilterBar({ children, className, results }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3",
        className
      )}
    >
      {children}
      {results && (
        <span className="ms-auto text-xs text-[var(--color-muted-foreground)]">{results}</span>
      )}
    </div>
  );
}
