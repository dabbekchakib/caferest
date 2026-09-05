import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface PageContainerProps extends HTMLAttributes<HTMLDivElement> {
  maxWidth?: "sm" | "md" | "lg" | "xl" | "full";
}

const maxWidthMap = {
  sm: "max-w-2xl",
  md: "max-w-3xl",
  lg: "max-w-5xl",
  xl: "max-w-7xl",
  full: "max-w-none",
} as const;

export function PageContainer({
  className,
  maxWidth = "xl",
  children,
  ...props
}: PageContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 py-6 sm:px-6 lg:px-8",
        maxWidthMap[maxWidth],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
