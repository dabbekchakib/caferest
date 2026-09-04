import type { ReactNode } from "react";
import { PackageOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center",
        className
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]">
        {icon ?? <PackageOpen className="size-7" aria-hidden />}
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-[var(--color-foreground)]">{title}</h3>
        {description && (
          <p className="mx-auto max-w-sm text-sm text-[var(--color-muted-foreground)]">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
