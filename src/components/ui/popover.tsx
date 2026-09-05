"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks/use-click-outside";

interface PopoverContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  close: () => void;
}

const PopoverContext = createContext<PopoverContextValue | null>(null);

function usePopover() {
  const ctx = useContext(PopoverContext);
  if (!ctx) throw new Error("Popover components must be used inside <Popover>");
  return ctx;
}

export interface PopoverProps {
  children: ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Popover({
  children,
  className,
  open: controlled,
  onOpenChange,
}: PopoverProps) {
  const [internal, setInternal] = useState(false);
  const open = controlled ?? internal;
  const setOpen = (o: boolean) => {
    if (controlled === undefined) setInternal(o);
    onOpenChange?.(o);
  };
  const close = () => setOpen(false);
  const ref = useClickOutside<HTMLDivElement>(close, open);
  return (
    <PopoverContext.Provider value={{ open, setOpen, close }}>
      <div ref={ref} className={cn("relative inline-block", className)}>
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

export interface PopoverTriggerProps {
  children: ReactNode;
  className?: string;
}

export function PopoverTrigger({ children, className }: PopoverTriggerProps) {
  const { open, setOpen } = usePopover();
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      onClick={() => setOpen(!open)}
      className={className}
    >
      {children}
    </button>
  );
}

export interface PopoverContentProps {
  children: ReactNode;
  className?: string;
  align?: "start" | "end" | "center";
}

export function PopoverContent({
  children,
  className,
  align = "start",
}: PopoverContentProps) {
  const { open } = usePopover();
  if (!open) return null;
  return (
    <div
      className={cn(
        "absolute z-[60] mt-1.5 w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-popover)] p-3 shadow-lg animate-slide-in-from-top",
        {
          "start-0": align === "start",
          "end-0": align === "end",
          "left-1/2 -translate-x-1/2 rtl:translate-x-1/2": align === "center",
        },
        className
      )}
    >
      {children}
    </div>
  );
}
