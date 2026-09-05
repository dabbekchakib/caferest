import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  error?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, error, id, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="checkbox"
        id={id}
        aria-invalid={error ? true : undefined}
        className={cn(
          "size-4 shrink-0 cursor-pointer rounded border-[var(--color-input)] bg-[var(--color-surface)] text-[var(--color-primary)] accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);

Checkbox.displayName = "Checkbox";

export { Checkbox };
