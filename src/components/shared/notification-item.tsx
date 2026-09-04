import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface NotificationItemProps {
  title: string;
  description?: string;
  time?: string;
  icon?: ReactNode;
  unread?: boolean;
  action?: ReactNode;
  className?: string;
}

export function NotificationItem({
  title,
  description,
  time,
  icon,
  unread = false,
  action,
  className,
}: NotificationItemProps) {
  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-[var(--color-muted)]",
        className
      )}
    >
      {unread && (
        <span className="absolute top-3 end-3 size-2 rounded-full bg-[var(--color-primary)]" aria-hidden />
      )}
      {icon && <div className="mt-0.5 shrink-0 text-[var(--color-muted-foreground)]">{icon}</div>}
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className={cn("truncate text-sm", unread ? "font-semibold text-[var(--color-foreground)]" : "text-[var(--color-foreground)]")}>
          {title}
        </p>
        {description && (
          <p className="line-clamp-2 text-xs text-[var(--color-muted-foreground)]">{description}</p>
        )}
        {time && <p className="text-xs text-[var(--color-muted-foreground)]">{time}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
