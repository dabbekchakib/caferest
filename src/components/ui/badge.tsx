import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "secondary" | "success" | "warning" | "danger";
}

function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
        {
          "bg-[var(--color-primary)]/10 text-[var(--color-primary)]":
            variant === "default",
          "bg-[var(--color-secondary)]/10 text-[var(--color-secondary)]":
            variant === "secondary",
          "bg-[var(--color-success)]/10 text-[var(--color-success)]":
            variant === "success",
          "bg-[var(--color-warning)]/10 text-[var(--color-warning)]":
            variant === "warning",
          "bg-[var(--color-danger)]/10 text-[var(--color-danger)]":
            variant === "danger",
        },
        className
      )}
      {...props}
    />
  );
}

export { Badge };
