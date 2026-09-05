"use client";

import { Coffee } from "lucide-react";

interface ProductImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

/**
 * Product picture with a neutral placeholder fallback. The image is a
 * public URL from the `product-images` bucket or a data-URL preview.
 */
export function ProductImage({ src, alt, className }: ProductImageProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={`rounded-lg border border-[var(--color-border)] object-cover ${className ?? ""}`}
      />
    );
  }
  return (
    <span
      className={`flex items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-muted)] text-[var(--color-muted-foreground)] ${className ?? ""}`}
      aria-hidden
    >
      <Coffee className="size-6" />
    </span>
  );
}