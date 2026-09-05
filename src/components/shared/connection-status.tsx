"use client";

import { Loader2, Wifi, WifiOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type ConnectionStatusState = "online" | "offline" | "syncing";

export interface ConnectionStatusProps {
  status?: ConnectionStatusState;
  label?: string;
  className?: string;
}

export function ConnectionStatus({
  status = "online",
  label,
  className,
}: ConnectionStatusProps) {
  const t = useTranslations("common");

  const resolvedLabel =
    label ??
    (status === "online"
      ? t("connection.online")
      : status === "offline"
        ? t("connection.offline")
        : t("connection.syncing"));

  const Icon = status === "offline" ? WifiOff : Wifi;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium",
        className
      )}
    >
      {status === "syncing" ? (
        <Loader2
          className="size-3.5 animate-spin text-[var(--color-warning)]"
          aria-hidden
        />
      ) : (
        <Icon
          className={cn(
            "size-3.5",
            status === "online"
              ? "text-[var(--color-success)]"
              : "text-[var(--color-danger)]"
          )}
          aria-hidden
        />
      )}
      <span className="text-[var(--color-muted-foreground)]">
        {resolvedLabel}
      </span>
    </div>
  );
}
