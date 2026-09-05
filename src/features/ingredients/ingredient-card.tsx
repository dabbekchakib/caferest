"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IngredientImage } from "./ingredient-image";
import { IngredientTypeBadge, IngredientBadges } from "./ingredient-badges";
import { formatCost } from "@/lib/ingredients/formatters";
import { resolveIngredientName } from "@/lib/ingredients/translations";
import type { IngredientWithTranslations } from "@/lib/ingredients/types";

interface IngredientCardProps {
  ingredient: IngredientWithTranslations;
  categoryLabel: string | null;
  costPerBaseUnit: number | null;
}

/** Catalog card used by the ingredients grid view. */
export function IngredientCard({
  ingredient,
  categoryLabel,
  costPerBaseUnit,
}: IngredientCardProps) {
  const t = useTranslations("ingredients");
  const locale = useLocale();
  const name = resolveIngredientName(
    ingredient.name,
    ingredient.translations,
    locale
  );

  return (
    <Card className="flex flex-col gap-3 p-4">
      <Link
        href={`/ingredients/${ingredient.id}`}
        className="group flex flex-col gap-3"
        aria-label={t("actions.view")}
      >
        <div className="flex items-start gap-3">
          <IngredientImage src={ingredient.image_url} alt={name} className="size-20" />
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
              {ingredient.sku ?? t("details.noSku")}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-base font-semibold">
            {costPerBaseUnit !== null
              ? `${formatCost(costPerBaseUnit, locale)} TND`
              : "—"}
          </span>
          <IngredientTypeBadge ingredient={ingredient} />
        </div>
        <IngredientBadges ingredient={ingredient} />
      </Link>

      <div className="mt-auto">
        <Link href={`/ingredients/${ingredient.id}`}>
          <Button variant="outline" size="sm" className="w-full">
            {t("actions.view")}
          </Button>
        </Link>
      </div>
    </Card>
  );
}