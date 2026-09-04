import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type { SkeletonProps };

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("skeleton rounded-md", className)}
        aria-hidden
        {...props}
      />
    );
  }
);

Skeleton.displayName = "Skeleton";

export { Skeleton };
