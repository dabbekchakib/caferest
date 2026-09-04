import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "outline" | "ghost" | "danger" | "success";
  size?: "sm" | "md" | "lg" | "icon" | "icon-sm" | "icon-lg";
  loading?: boolean;
  fullWidth?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex shrink-0 select-none items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
          {
            "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-active)]":
              variant === "primary",
            "bg-[var(--color-secondary)] text-[var(--color-secondary-foreground)] hover:bg-[var(--color-secondary-hover)] active:bg-[var(--color-secondary-active)]":
              variant === "secondary",
            "bg-[var(--color-accent)] text-[var(--color-accent-foreground)] hover:bg-[var(--color-accent-hover)] active:bg-[var(--color-accent-active)]":
              variant === "accent",
            "border border-[var(--color-border)] bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-muted)] active:bg-[var(--color-muted)]":
              variant === "outline",
            "bg-transparent text-[var(--color-foreground)] hover:bg-[var(--color-muted)] active:bg-[var(--color-muted)]":
              variant === "ghost",
            "bg-[var(--color-danger)] text-[var(--color-danger-foreground)] hover:opacity-90 active:opacity-80":
              variant === "danger",
            "bg-[var(--color-success)] text-[var(--color-success-foreground)] hover:opacity-90 active:opacity-80":
              variant === "success",
          },
          {
            "h-9 px-3 text-sm": size === "sm",
            "h-11 px-4 text-sm": size === "md",
            "h-12 px-6 text-base": size === "lg",
            "h-11 w-11": size === "icon",
            "h-9 w-9": size === "icon-sm",
            "h-14 w-14": size === "icon-lg",
          },
          fullWidth && "w-full",
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";

export { Button };
