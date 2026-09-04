import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorState({
  title = "Une erreur est survenue",
  description = "Impossible de charger les données. Veuillez réessayer.",
  action,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] px-6 py-16 text-center",
        className
      )}
    >
      <div className="flex size-14 items-center justify-center rounded-full bg-[var(--color-danger)]/10 text-[var(--color-danger)]">
        <AlertTriangle className="size-7" aria-hidden />
      </div>
      <div className="space-y-1">
        <h3 className="text-lg font-semibold text-[var(--color-danger)]">{title}</h3>
        <p className="text-sm text-[var(--color-foreground)]">{description}</p>
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
