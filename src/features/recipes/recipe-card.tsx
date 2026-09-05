"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecipeStatusBadge, RecipeDefaultBadge } from "./recipe-badges";
import { resolveRecipeName } from "@/lib/recipes/translations";
import { formatRecipeCost } from "@/lib/recipes/format";
import type { RecipeListViewItem } from "@/lib/recipes/types";

interface RecipeCardProps {
  recipe: RecipeListViewItem;
  /** Estimated raw cost; null hides the cost row. */
  cost: number | null;
}

/** Catalog card used by the recipes grid view. */
export function RecipeCard({ recipe, cost }: RecipeCardProps) {
  const t = useTranslations("recipes");
  const ta = useTranslations("recipeActions");
  const locale = useLocale();
  const name = resolveRecipeName(recipe.name, recipe.translations, locale);

  return (
    <Card className="flex flex-col gap-3 p-4">
      <Link
        href={`/recipes/${recipe.id}`}
        className="group flex flex-col gap-3"
        aria-label={ta("view")}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium group-hover:underline">
              {name}
            </p>
            <p className="truncate text-xs text-[var(--color-muted-foreground)]">
              {recipe.productName}
            </p>
            <Badge variant="muted" size="sm" className="mt-1">
              {t("table.version")} {recipe.version}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <RecipeStatusBadge status={recipe.status} />
          {recipe.is_default && <RecipeDefaultBadge />}
        </div>
        {cost !== null && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-muted-foreground)]">
              {t("table.cost")}
            </span>
            <span className="font-semibold">{formatRecipeCost(cost, locale)}</span>
          </div>
        )}
      </Link>

      <div className="mt-auto">
        <Link href={`/recipes/${recipe.id}`}>
          <Button variant="outline" size="sm" className="w-full">
            {ta("view")}
          </Button>
        </Link>
      </div>
    </Card>
  );
}
