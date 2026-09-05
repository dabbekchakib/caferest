"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { RecipeStatus } from "@/lib/recipes/types";

const STATUS_VARIANT: Record<
  RecipeStatus,
  "success" | "warning" | "muted" | "danger"
> = {
  active: "success",
  draft: "warning",
  inactive: "muted",
  archived: "danger",
};

export function RecipeStatusBadge({ status }: { status: RecipeStatus }) {
  const t = useTranslations("recipeStatus");
  return (
    <Badge variant={STATUS_VARIANT[status]} size="sm" dot>
      {t(status)}
    </Badge>
  );
}

export function RecipeDefaultBadge() {
  const t = useTranslations("recipeDetails");
  return (
    <Badge variant="primary" size="sm">
      {t("defaultBadge")}
    </Badge>
  );
}

export function RecipeSystemBadge() {
  const t = useTranslations("recipeStatus");
  return (
    <Badge variant="primary" size="sm">
      {t("system")}
    </Badge>
  );
}
