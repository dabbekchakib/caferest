import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type RadioProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">;

const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ className, id, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="radio"
        id={id}
        className={cn(
          "size-4 shrink-0 cursor-pointer rounded-full border-[var(--color-input)] bg-[var(--color-surface)] text-[var(--color-primary)] accent-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
    );
  }
);

Radio.displayName = "Radio";

export { Radio };
