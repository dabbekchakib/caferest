"use client";

import {
  useEffect,
  useRef,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useLockBody } from "@/hooks/use-lock-body";

export type DialogSize = "sm" | "md" | "lg" | "xl" | "full";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  size?: DialogSize;
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  hideClose?: boolean;
  closeOnOverlay?: boolean;
}

const sizeMap: Record<DialogSize, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
  full: "sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl",
};

export function Dialog({
  open,
  onOpenChange,
  children,
  size = "md",
  className,
  title,
  description,
  footer,
  hideClose = false,
  closeOnOverlay = true,
}: DialogProps) {
  const panelRef = useFocusTrap<HTMLDivElement>();
  useLockBody(open);
  const panelRefEl = useRef<HTMLDivElement | null>(null);

  function mergeRef(el: HTMLDivElement | null) {
    panelRef.current = el;
    panelRefEl.current = el;
  }

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function handleOverlayClick(e: ReactMouseEvent) {
    if (closeOnOverlay && panelRefEl.current && !panelRefEl.current.contains(e.target as Node)) {
      onOpenChange(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <div
        className="absolute inset-0 animate-fade-in bg-black/50"
        onClick={handleOverlayClick}
        aria-hidden
      />
      <div
        ref={mergeRef}
        className={cn(
          "relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-[var(--color-popover)] shadow-xl animate-slide-in-from-bottom sm:rounded-2xl sm:animate-zoom-in",
          sizeMap[size],
          className
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] p-5">
            <div className="space-y-1">
              {title && <h2 className="text-lg font-semibold">{title}</h2>}
              {description && (
                <p className="text-sm text-[var(--color-muted-foreground)]">{description}</p>
              )}
            </div>
            {!hideClose && (
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-md p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                aria-label="Fermer"
              >
                <X className="size-5" aria-hidden />
              </button>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] p-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export function DialogFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-5 flex items-center justify-end gap-2", className)} {...props}>
      {children}
    </div>
  );
}

export function DialogContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-4", className)} {...props}>
      {children}
    </div>
  );
}
