import { Badge } from "@/components/ui/badge";
import type { BadgeProps } from "@/components/ui/badge";

export type StatusVariant = "success" | "warning" | "danger" | "info" | "muted" | "primary";

export interface StatusBadgeProps {
  status: StatusVariant;
  label: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, label, size = "md" }: StatusBadgeProps) {
  const variantMap: Record<StatusVariant, BadgeProps["variant"]> = {
    success: "success",
    warning: "warning",
    danger: "danger",
    info: "info",
    muted: "muted",
    primary: "primary",
  };
  return (
    <Badge variant={variantMap[status]} size={size} dot>
      {label}
    </Badge>
  );
}
