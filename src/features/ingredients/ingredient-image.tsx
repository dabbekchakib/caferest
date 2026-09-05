"use client";

import { Wheat } from "lucide-react";

interface IngredientImageProps {
  src: string | null;
  alt: string;
  className?: string;
}

/**
 * Ingredient picture with a neutral placeholder fallback. The image is a
 * public URL from the `ingredient-images` bucket or a data-URL preview.
 */
export function IngredientImage({ src, alt, className }: IngredientImageProps) {
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
      <Wheat className="size-6" />
    </span>
  );
}