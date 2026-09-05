import { forwardRef, type HTMLAttributes } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg" | "xl";
  fallback?: string;
}

const sizeMap = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-12 text-base",
  xl: "size-16 text-lg",
} as const;

const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(
  ({ className, src, alt = "", size = "md", fallback, ...props }, ref) => {
    if (src) {
      return (
        <span
          ref={ref}
          className={cn(
            "inline-flex shrink-0 overflow-hidden rounded-full",
            sizeMap[size],
            className
          )}
          {...props}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="size-full object-cover" />
        </span>
      );
    }
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
          sizeMap[size],
          className
        )}
        {...props}
      >
        {fallback ? (
          <span className="font-semibold uppercase">{fallback}</span>
        ) : (
          <User className="size-1/2" aria-hidden />
        )}
      </span>
    );
  }
);

Avatar.displayName = "Avatar";

export { Avatar };
