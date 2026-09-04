"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface SwitchProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onCheckedChange?.(!checked);
        }}
        className={cn(
          "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
          checked
            ? "bg-[var(--color-primary)]"
            : "bg-[var(--color-muted-foreground)]",
          className
        )}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none flex size-5 items-center justify-center rounded-full bg-white shadow transition-transform",
            checked
              ? "translate-x-[22px] rtl:-translate-x-[22px]"
              : "translate-x-[2px] rtl:-translate-x-[2px]"
          )}
        />
      </button>
    );
  }
);

Switch.displayName = "Switch";

export { Switch };
