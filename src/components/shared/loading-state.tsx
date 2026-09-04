import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label = "Chargement...", className }: LoadingStateProps) {
  return (
    <div
      role="status"
      className={cn("flex flex-col items-center justify-center gap-3 py-16 text-center", className)}
      aria-label={label}
    >
      <LoaderCircle className="size-8 animate-spin text-[var(--color-primary)]" aria-hidden />
      <p className="text-sm text-[var(--color-muted-foreground)]">{label}</p>
    </div>
  );
}

export interface LoadingSkeletonProps {
  rows?: number;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-11 rounded-lg bg-[var(--color-muted)] skeleton" />
      ))}
    </div>
  );
}
