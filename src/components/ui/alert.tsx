import { forwardRef, type HTMLAttributes } from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: "info" | "success" | "warning" | "danger";
  title?: React.ReactNode;
  action?: React.ReactNode;
}

const config = {
  info: {
    icon: Info,
    bg: "bg-[var(--color-info-bg)]",
    border: "border-[var(--color-info)]",
    text: "text-[var(--color-info)]",
  },
  success: {
    icon: CheckCircle2,
    bg: "bg-[var(--color-success-bg)]",
    border: "border-[var(--color-success)]",
    text: "text-[var(--color-success)]",
  },
  warning: {
    icon: TriangleAlert,
    bg: "bg-[var(--color-warning-bg)]",
    border: "border-[var(--color-warning)]",
    text: "text-[var(--color-warning)]",
  },
  danger: {
    icon: AlertCircle,
    bg: "bg-[var(--color-danger-bg)]",
    border: "border-[var(--color-danger)]",
    text: "text-[var(--color-danger)]",
  },
} as const;

const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "info", title, children, action, ...props }, ref) => {
    const Icon = config[variant].icon;
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "relative flex w-full items-start gap-3 rounded-lg border p-4",
          config[variant].bg,
          config[variant].border,
          className
        )}
        {...props}
      >
        <Icon className={cn("mt-0.5 size-5 shrink-0", config[variant].text)} aria-hidden />
        <div className="flex flex-1 flex-col gap-1">
          {title && <div className={cn("text-sm font-semibold", config[variant].text)}>{title}</div>}
          {children && (
            <div className="text-sm text-[var(--color-foreground)]">{children}</div>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  }
);

Alert.displayName = "Alert";

export { Alert };
