import type { HTMLAttributes, ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export type StatTrend = "up" | "down" | "neutral";

export interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  trend?: number;
  trendDirection?: StatTrend;
  trendLabel?: string;
  hint?: string;
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  trendDirection = "neutral",
  trendLabel,
  hint,
  className,
  ...props
}: StatCardProps) {
  return (
    <Card className={cn("p-5", className)} {...props}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--color-muted-foreground)]">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-foreground)]">{value}</p>
        </div>
        {icon && (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
            {icon}
          </div>
        )}
      </div>
      {(trend !== undefined || trendLabel) && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          {trend !== undefined && (
            <span
              className={cn(
                "inline-flex items-center gap-1 font-medium",
                trendDirection === "up" && "text-[var(--color-success)]",
                trendDirection === "down" && "text-[var(--color-danger)]",
                trendDirection === "neutral" && "text-[var(--color-muted-foreground)]"
              )}
            >
              {trendDirection === "up" && <TrendingUp className="size-3.5" aria-hidden />}
              {trendDirection === "down" && <TrendingDown className="size-3.5" aria-hidden />}
              {Math.abs(trend)}%
            </span>
          )}
          {trendLabel && <span className="text-[var(--color-muted-foreground)]">{trendLabel}</span>}
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{hint}</p>}
    </Card>
  );
}
