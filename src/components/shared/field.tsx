import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FieldProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode;
  htmlFor?: string;
  required?: boolean;
  description?: ReactNode;
  error?: ReactNode;
  helpText?: ReactNode;
  children: ReactNode;
}

export function Field({
  label,
  htmlFor,
  required = false,
  description,
  error,
  helpText,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-[var(--color-foreground)]"
        >
          {label}
          {required && (
            <span className="ml-0.5 text-[var(--color-danger)]" aria-hidden>
              *
            </span>
          )}
        </label>
      )}
      {description && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {description}
        </p>
      )}
      {children}
      {helpText && !error && (
        <p className="text-xs text-[var(--color-muted-foreground)]">
          {helpText}
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
}
