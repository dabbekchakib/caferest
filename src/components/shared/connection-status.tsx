"use client";

import { Loader2, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConnectionStatusState = "online" | "offline" | "syncing";

export interface ConnectionStatusProps {
  status?: ConnectionStatusState;
  label?: string;
  className?: string;
}

const config: Record<
  ConnectionStatusState,
  { label: string; dot: string; Icon: typeof Wifi }
> = {
  online: { label: "En ligne", dot: "bg-[var(--color-success)]", Icon: Wifi },
  offline: { label: "Hors connexion", dot: "bg-[var(--color-danger)]", Icon: WifiOff },
  syncing: { label: "Synchronisation...", dot: "bg-[var(--color-warning)]", Icon: Wifi },
};

export function ConnectionStatus({
  status = "online",
  label,
  className,
}: ConnectionStatusProps) {
  const cfg = config[status];
  const Icon = cfg.Icon;
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium",
        className
      )}
    >
      {status === "syncing" ? (
        <Loader2 className="size-3.5 animate-spin text-[var(--color-warning)]" aria-hidden />
      ) : (
        <Icon className={cn("size-3.5", status === "online" ? "text-[var(--color-success)]" : "text-[var(--color-danger)]")} aria-hidden />
      )}
      <span className="text-[var(--color-muted-foreground)]">{label ?? cfg.label}</span>
    </div>
  );
}
