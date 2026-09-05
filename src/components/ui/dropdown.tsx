"use client";

import {
  createContext,
  useContext,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { useClickOutside } from "@/hooks/use-click-outside";

interface DropdownContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  close: () => void;
}

const DropdownContext = createContext<DropdownContextValue | null>(null);

function useDropdown() {
  const ctx = useContext(DropdownContext);
  if (!ctx)
    throw new Error("Dropdown components must be used inside <Dropdown>");
  return ctx;
}

export interface DropdownProps {
  children: ReactNode;
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dropdown({
  children,
  className,
  open: controlled,
  onOpenChange,
}: DropdownProps) {
  const [internal, setInternal] = useState(false);
  const open = controlled ?? internal;
  const setOpen = (o: boolean) => {
    if (controlled === undefined) setInternal(o);
    onOpenChange?.(o);
  };
  const close = () => setOpen(false);
  const ref = useClickOutside<HTMLDivElement>(close, open);

  return (
    <DropdownContext.Provider value={{ open, setOpen, close }}>
      <div
        ref={ref}
        className={cn("relative inline-block text-left", className)}
      >
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export interface DropdownTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
}

export function DropdownTrigger({
  className,
  children,
  onClick,
  ...props
}: DropdownTriggerProps) {
  const { open, setOpen } = useDropdown();
  return (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      onClick={(e) => {
        onClick?.(e);
        setOpen(!open);
      }}
      className={className}
      {...props}
    >
      {children}
    </button>
  );
}

export interface DropdownContentProps {
  children: ReactNode;
  className?: string;
  align?: "start" | "end" | "center";
}

export function DropdownContent({
  children,
  className,
  align = "end",
}: DropdownContentProps) {
  const { open } = useDropdown();
  if (!open) return null;
  return (
    <div
      role="menu"
      className={cn(
        "absolute z-50 mt-1.5 min-w-[10rem] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-popover)] p-1 shadow-lg animate-slide-in-from-top focus:outline-none",
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

export interface DropdownItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children?: ReactNode;
  inset?: boolean;
}

export function DropdownItem({
  className,
  children,
  inset = false,
  ...props
}: DropdownItemProps) {
  const { close } = useDropdown();
  return (
    <button
      type="button"
      role="menuitem"
      onClick={(e) => {
        props.onClick?.(e);
        close();
      }}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-[var(--color-foreground)] transition-colors hover:bg-[var(--color-muted)] focus-visible:outline-none focus-visible:bg-[var(--color-muted)] disabled:pointer-events-none disabled:opacity-50 rtl:text-right",
        inset && "pl-8 rtl:pl-3 rtl:pr-8",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownLabel({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "px-3 py-1.5 text-xs font-medium text-[var(--color-muted-foreground)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DropdownSeparator({ className }: { className?: string }) {
  return (
    <div className={cn("my-1 h-px bg-[var(--color-border)]", className)} />
  );
}
