import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface MetricCardProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function MetricCard({
  label,
  value,
  sub,
  icon,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("flex flex-col p-4", className)}>
      <div className="flex items-center gap-2 text-[var(--color-muted-foreground)]">
        {icon && (
          <span className="text-[var(--color-muted-foreground)]">{icon}</span>
        )}
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="mt-2 text-xl font-bold text-[var(--color-foreground)]">
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          {sub}
        </div>
      )}
    </Card>
  );
}
