"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { Ingredient } from "@/lib/ingredients/types";

/** Single source of truth for the ingredient state badges: type, status, stock. */
export function IngredientTypeBadge({
  ingredient,
}: {
  ingredient: Ingredient;
}) {
  const t = useTranslations("ingredients");
  return (
    <Badge size="sm">{t(`types.${ingredient.ingredient_type}`)}</Badge>
  );
}

export function IngredientStatusBadge({ ingredient }: { ingredient: Ingredient }) {
  const t = useTranslations("ingredients");
  return ingredient.is_active ? (
    <Badge variant="success" size="sm" dot>
      {t("badges.active")}
    </Badge>
  ) : (
    <Badge variant="danger" size="sm" dot>
      {t("badges.inactive")}
    </Badge>
  );
}

export function IngredientStockBadge({ ingredient }: { ingredient: Ingredient }) {
  const t = useTranslations("ingredients");
  return ingredient.is_stock_tracked ? (
    <Badge size="sm">{t("badges.stockTracked")}</Badge>
  ) : (
    <Badge variant="outline" size="sm">
      {t("badges.stockNotTracked")}
    </Badge>
  );
}

export function IngredientBadges({ ingredient }: { ingredient: Ingredient }) {
  const t = useTranslations("ingredients");
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {ingredient.is_system && (
        <Badge variant="primary" size="sm">
          {t("badges.system")}
        </Badge>
      )}
      <IngredientStatusBadge ingredient={ingredient} />
      <IngredientStockBadge ingredient={ingredient} />
    </span>
  );
}