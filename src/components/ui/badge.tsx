import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "primary"
    | "secondary"
    | "accent"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "outline"
    | "muted";
  size?: "sm" | "md";
  dot?: boolean;
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      dot = false,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium",
          {
            "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]":
              variant === "primary",
            "bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)]":
              variant === "secondary",
            "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]":
              variant === "accent",
            "bg-[var(--color-success-bg)] text-[var(--color-success)]":
              variant === "success",
            "bg-[var(--color-warning-bg)] text-[var(--color-warning)]":
              variant === "warning",
            "bg-[var(--color-danger-bg)] text-[var(--color-danger)]":
              variant === "danger",
            "bg-[var(--color-info-bg)] text-[var(--color-info)]":
              variant === "info",
            "border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)]":
              variant === "outline",
            "bg-[var(--color-muted)] text-[var(--color-muted-foreground)]":
              variant === "muted",
          },
          {
            "px-2 py-0.5 text-[10px]": size === "sm",
            "px-2.5 py-1 text-xs": size === "md",
          },
          className
        )}
        {...props}
      >
        {dot && <StatusDot variant={variant} />}
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

function StatusDot({ variant }: { variant: BadgeProps["variant"] }) {
  const colorMap: Record<NonNullable<BadgeProps["variant"]>, string> = {
    primary: "bg-[var(--color-primary)]",
    secondary: "bg-[var(--color-secondary)]",
    accent: "bg-[var(--color-accent)]",
    success: "bg-[var(--color-success)]",
    warning: "bg-[var(--color-warning)]",
    danger: "bg-[var(--color-danger)]",
    info: "bg-[var(--color-info)]",
    outline: "bg-[var(--color-muted-foreground)]",
    muted: "bg-[var(--color-muted-foreground)]",
  };
  return (
    <span
      className={cn("size-1.5 rounded-full", colorMap[variant ?? "muted"])}
      aria-hidden
    />
  );
}

export { Badge };
