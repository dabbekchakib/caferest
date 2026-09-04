"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  delay?: number;
}

export function Tooltip({
  content,
  children,
  side = "top",
  className,
  delay = 300,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  function show() {
    if (timer) clearTimeout(timer);
    const t = setTimeout(() => setVisible(true), delay);
    setTimer(t);
  }

  function hide() {
    if (timer) clearTimeout(timer);
    setVisible(false);
  }

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children}
      {visible && (
        <span
          role="tooltip"
          className={cn(
            "pointer-events-none absolute z-[60] whitespace-nowrap rounded-md bg-[var(--color-foreground)] px-2 py-1 text-xs text-[var(--color-background)] shadow-lg animate-fade-in",
            {
              "bottom-full left-1/2 mb-1.5 -translate-x-1/2 rtl:translate-x-1/2": side === "top",
              "top-full left-1/2 mt-1.5 -translate-x-1/2 rtl:translate-x-1/2": side === "bottom",
              "right-full top-1/2 mr-1.5 -translate-y-1/2": side === "left",
              "left-full top-1/2 ml-1.5 -translate-y-1/2": side === "right",
            },
            className
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
