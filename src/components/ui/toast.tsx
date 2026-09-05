"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Info, TriangleAlert, X, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  useToastStore,
  type Toast,
  type ToastVariant,
} from "@/stores/use-toast-store";
import { cn } from "@/lib/utils";

const config: Record<ToastVariant, { icon: typeof Info; classes: string }> = {
  info: { icon: Info, classes: "text-[var(--color-info)]" },
  success: { icon: CheckCircle2, classes: "text-[var(--color-success)]" },
  warning: { icon: TriangleAlert, classes: "text-[var(--color-warning)]" },
  danger: { icon: XCircle, classes: "text-[var(--color-danger)]" },
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss);
  const t = useTranslations("common");
  const Icon = config[toast.variant].icon;
  return (
    <div
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-popover)] p-4 shadow-lg animate-slide-in-from-right rtl:animate-slide-in-from-left"
      role="alert"
    >
      <Icon
        className={cn("mt-0.5 size-5 shrink-0", config[toast.variant].classes)}
        aria-hidden
      />
      <div className="flex-1 space-y-0.5">
        {toast.title && (
          <p className="text-sm font-semibold text-[var(--color-foreground)]">
            {toast.title}
          </p>
        )}
        {toast.description && (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        className="rounded p-1 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
        aria-label={t("closeNotification")}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-full max-w-sm flex-col gap-2 rtl:left-4 rtl:right-auto"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body
  );
}
