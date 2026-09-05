"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/lib/products/types";

/**
 * Single source of truth for the product state badges:
 * type, active status, availability, POS visibility, featured, stock, system.
 */
export function ProductTypeBadge({ product }: { product: Product }) {
  const t = useTranslations("products");
  return <Badge size="sm">{t(`types.${product.product_type}`)}</Badge>;
}

export function ProductStatusBadge({ product }: { product: Product }) {
  const t = useTranslations("products");
  return product.is_active ? (
    <Badge variant="success" size="sm" dot>
      {t("badges.active")}
    </Badge>
  ) : (
    <Badge variant="danger" size="sm" dot>
      {t("badges.inactive")}
    </Badge>
  );
}

export function ProductAvailabilityBadge({ product }: { product: Product }) {
  const t = useTranslations("products");
  return product.is_available ? (
    <Badge variant="success" size="sm">
      {t("badges.available")}
    </Badge>
  ) : (
    <Badge variant="secondary" size="sm">
      {t("badges.unavailable")}
    </Badge>
  );
}

export function ProductBadges({ product }: { product: Product }) {
  const t = useTranslations("products");
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {product.is_system && (
        <Badge variant="primary" size="sm">
          {t("badges.system")}
        </Badge>
      )}
      <ProductStatusBadge product={product} />
      <ProductAvailabilityBadge product={product} />
      {product.is_pos_enabled ? (
        <Badge size="sm">{t("badges.posEnabled")}</Badge>
      ) : (
        <Badge variant="outline" size="sm">
          {t("badges.posDisabled")}
        </Badge>
      )}
      {product.is_featured && (
        <Badge variant="primary" size="sm">
          {t("badges.featured")}
        </Badge>
      )}
      {product.is_stock_tracked && (
        <Badge variant="outline" size="sm">
          {t("badges.stockTracked")}
        </Badge>
      )}
    </span>
  );
}