"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RecipeStatusBadge, RecipeDefaultBadge } from "./recipe-badges";
import { resolveRecipeName } from "@/lib/recipes/translations";
import { formatRecipeCost } from "@/lib/recipes/format";
import type { RecipeListViewItem } from "@/lib/recipes/types";

interface ProductRecipeSectionProps {
  /** Versions of the product's recipes, ordered by sort then version. */
  recipes: RecipeListViewItem[];
  /** Estimated raw cost per recipe id; null/absent rows hide the cost. */
  costs: Record<string, number | null>;
  canViewCost: boolean;
  canCreate: boolean;
  /** i18n namespace owning the `details.recipe` heading label. */
  titleNamespace?: "products" | "ingredients";
  /** Show the linked product under each recipe name (ingredient context). */
  showProduct?: boolean;
}

/**
 * Product tab section listing the product's recipe versions. Server pages
 * fetch the catalog, the optional costs and the permission flags, then render
 * this client component (it needs the active locale + translations).
 */
export function ProductRecipeSection({
  recipes,
  costs,
  canViewCost,
  canCreate,
  titleNamespace = "products",
  showProduct = false,
}: ProductRecipeSectionProps) {
  const t = useTranslations(titleNamespace);
  const tr = useTranslations("recipes");
  const ta = useTranslations("recipeActions");
  const locale = useLocale();

  return (
    <Card className="p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("details.recipe")}</h3>
        {canCreate && (
          <Link href="/recipes/create">
            <Button variant="outline" size="sm">
              <Plus className="size-4" aria-hidden /> {tr("createButton")}
            </Button>
          </Link>
        )}
      </div>

      {recipes.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {tr("noRecipes")}
        </p>
      ) : (
        <ul className="space-y-2">
          {recipes.map((recipe) => {
            const name = resolveRecipeName(
              recipe.name,
              recipe.translations,
              locale
            );
            return (
              <li key={recipe.id}>
                <Link
                  href={`/recipes/${recipe.id}`}
                  aria-label={ta("view")}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] p-3 transition-colors hover:border-[var(--color-primary)]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{name}</span>
                      <Badge variant="muted" size="sm">
                        {tr("table.version")} {recipe.version}
                      </Badge>
                    </div>
                    {showProduct && (
                      <p className="mt-0.5 truncate text-xs text-[var(--color-muted-foreground)]">
                        {recipe.productName}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <RecipeStatusBadge status={recipe.status} />
                      {recipe.is_default && <RecipeDefaultBadge />}
                    </div>
                  </div>
                  {canViewCost && costs[recipe.id] != null && (
                    <span className="shrink-0 text-sm font-semibold">
                      {formatRecipeCost(costs[recipe.id], locale)}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}