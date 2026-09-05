"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductImage } from "./product-image";
import { ProductTypeBadge, ProductBadges } from "./product-badges";
import { formatCurrency } from "@/lib/format";
import { resolveProductName } from "@/lib/products/translations";
import type { ProductWithTranslations } from "@/lib/products/types";

interface ProductCardProps {
  product: ProductWithTranslations;
  categoryLabel: string | null;
}

/** Catalog card used by the products grid view. */
export function ProductCard({ product, categoryLabel }: ProductCardProps) {
  const t = useTranslations("products");
  const locale = useLocale();
  const name = resolveProductName(product.name, product.translations, locale);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <Link
        href={`/products/${product.id}`}
        className="group flex flex-col gap-3"
        aria-label={t("actions.view")}
      >
        <div className="flex items-start gap-3">
          <ProductImage src={product.image_url} alt={name} className="size-20" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium group-hover:underline">
              {name}
            </p>
            {categoryLabel && (
              <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                {categoryLabel}
              </p>
            )}
            <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
              {product.sku ?? t("details.noSku")}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold">
            {formatCurrency(product.price)}
          </span>
          <ProductTypeBadge product={product} />
        </div>
        <ProductBadges product={product} />
      </Link>

      <div className="mt-auto">
        <Link href={`/products/${product.id}`}>
          <Button variant="outline" size="sm" className="w-full">
            {t("actions.view")}
          </Button>
        </Link>
      </div>
    </Card>
  );
}