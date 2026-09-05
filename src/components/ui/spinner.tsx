import { forwardRef, type HTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg";
  label?: string;
}

const sizeMap = {
  sm: "size-4",
  md: "size-6",
  lg: "size-8",
} as const;

const Spinner = forwardRef<HTMLDivElement, SpinnerProps>(
  ({ className, size = "md", label, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-label={label ?? "Chargement"}
        className={cn("inline-flex items-center justify-center", className)}
        {...props}
      >
        <Loader2
          className={cn(
            "animate-spin text-[var(--color-primary)]",
            sizeMap[size]
          )}
          aria-hidden
        />
        {label && <span className="sr-only">{label}</span>}
      </div>
    );
  }
);

Spinner.displayName = "Spinner";

export { Spinner };
