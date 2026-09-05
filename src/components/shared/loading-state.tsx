import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface LoadingStateProps {
  label?: string;
  className?: string;
}

export function LoadingState({ label, className }: LoadingStateProps) {
  const t = useTranslations("common");
  const resolvedLabel = label ?? t("common.loading");
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-center",
        className
      )}
      aria-label={resolvedLabel}
    >
      <LoaderCircle
        className="size-8 animate-spin text-[var(--color-primary)]"
        aria-hidden
      />
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {resolvedLabel}
      </p>
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
        <div
          key={i}
          className="h-11 rounded-lg bg-[var(--color-muted)] skeleton"
        />
      ))}
    </div>
  );
}
