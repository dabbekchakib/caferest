"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { IngredientLineSelector } from "./ingredient-line-selector";
import { SubRecipeSelector } from "./sub-recipe-selector";
import { filterUnitsCompatibleWith, parseRecipeDecimal } from "@/lib/recipes/formatters";
import { formatRecipeCost } from "@/lib/recipes/format";
import { cn } from "@/lib/utils";
import type { Unit, UnitConversion } from "@/lib/units/types";
import type { IngredientSelectorEntry } from "@/lib/ingredients/types";
import type { RecipeSelectorEntry } from "@/lib/recipes/types";

export interface RecipeBuilderItem {
  key: string;
  refType: "ingredient" | "subRecipe";
  refId: string | null;
  refLabel: string;
  ingredientBaseUnitId: string | null;
  quantity: string;
  unitId: string | null;
  wastePercentage: string;
  notes: string;
  sortOrder: number;
}

interface RecipeItemRowProps {
  item: RecipeBuilderItem;
  index: number;
  units: Unit[];
  conversions: UnitConversion[];
  canViewCost: boolean;
  costContribution: number | null | undefined;
  errors?: Record<string, string | undefined>;
  onPatch: (index: number, patch: Partial<RecipeBuilderItem>) => void;
  onSelectIngredient: (index: number, entry: IngredientSelectorEntry) => void;
  onSelectSubRecipe: (index: number, entry: RecipeSelectorEntry) => void;
  onRemove: (index: number) => void;
  locale: string;
}

export function RecipeItemRow({
  item,
  index,
  units,
  conversions,
  canViewCost,
  costContribution,
  errors,
  onPatch,
  onSelectIngredient,
  onSelectSubRecipe,
  onRemove,
  locale,
}: RecipeItemRowProps) {
  const t = useTranslations("recipeBuilder");
  const tv = useTranslations("recipeValidation");

  const compatibleUnits = useMemo(
    () => filterUnitsCompatibleWith(units, item.ingredientBaseUnitId, conversions),
    [units, conversions, item.ingredientBaseUnitId]
  );

  const missingRef = errors?.ref ?? undefined;
  const quantityInvalid = parseRecipeDecimal(item.quantity) === null;
  const quantityError = errors?.quantity ?? (item.quantity && quantityInvalid ? tv("itemRefRequired") : undefined);
  const wasteInvalid =
    item.wastePercentage.trim() !== "" && parseRecipeDecimal(item.wastePercentage) === null;
  const wasteError = errors?.waste ?? (wasteInvalid ? tv("empty") : undefined);

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      {missingRef && (
        <p role="alert" className="mb-2 text-xs text-[var(--color-danger)]">
          {missingRef}
        </p>
      )}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-2">
        <span className="flex w-6 shrink-0 items-center justify-center pt-3 text-xs font-medium text-[var(--color-muted-foreground)]">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          {item.refType === "ingredient" ? (
            <IngredientLineSelector
              value={
                item.refId
                  ? ({
                      id: item.refId,
                      name: item.refLabel,
                      sku: null,
                      ingredientType: "raw_material",
                      baseUnitId: item.ingredientBaseUnitId,
                      purchaseUnitId: null,
                      baseUnitSymbol: null,
                      purchaseUnitSymbol: null,
                      purchaseQuantity: 0,
                      purchaseCost: 0,
                      costPerBaseUnit: null,
                      categoryId: null,
                      categoryName: null,
                      imageUrl: null,
                      isActive: true,
                      isStockTracked: false,
                      wastePercentage: 0,
                    } satisfies IngredientSelectorEntry)
                  : null
              }
              onChange={(entry) => {
                if (entry) onSelectIngredient(index, entry);
                else onPatch(index, { refId: null, refLabel: "", ingredientBaseUnitId: null });
              }}
              aria-invalid={missingRef ? true : undefined}
            />
          ) : (
            <SubRecipeSelector
              value={
                item.refId
                  ? ({
                      id: item.refId,
                      name: item.refLabel,
                      version: 0,
                      status: "draft",
                      isDefault: false,
                      hasItems: false,
                      itemCount: 0,
                      cost: null,
                      productName: null,
                    } satisfies RecipeSelectorEntry)
                  : null
              }
              onChange={(entry) => {
                if (entry) onSelectSubRecipe(index, entry);
                else onPatch(index, { refId: null, refLabel: "" });
              }}
            />
          )}
        </div>

        <div className="shrink-0 lg:pt-1.5">
          {item.refType === "subRecipe" ? (
            <Badge variant="outline" size="sm">
              {t("subRecipeBadge")}
            </Badge>
          ) : null}
        </div>

        <Input
          inputMode="decimal"
          value={item.quantity}
          onChange={(e) => onPatch(index, { quantity: e.target.value })}
          placeholder="0"
          aria-label={t("table.quantity")}
          className={cn("w-full lg:w-24", quantityError && "border-[var(--color-danger)]")}
        />

        <Select
          aria-label={t("table.unit")}
          value={item.unitId ?? ""}
          onChange={(e) =>
            onPatch(index, { unitId: e.target.value === "" ? null : e.target.value })
          }
          className="w-full lg:w-36"
        >
          <option value="">{t("emptyInterval")}</option>
          {compatibleUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.symbol || unit.name}
            </option>
          ))}
        </Select>

        <Input
          inputMode="numeric"
          value={item.wastePercentage}
          onChange={(e) => onPatch(index, { wastePercentage: e.target.value })}
          placeholder="0"
          aria-label={t("table.waste")}
          className={cn("w-full lg:w-20", wasteError && "border-[var(--color-danger)]")}
        />

        {canViewCost && (
          <div className="flex w-full items-center justify-between gap-2 pt-2 lg:w-28 lg:justify-end lg:pt-3">
            <span className="text-xs text-[var(--color-muted-foreground)] lg:hidden">
              {t("table.cost")}
            </span>
            <span className="text-sm font-medium">
              {costContribution !== undefined
                ? formatRecipeCost(costContribution, locale)
                : t("emptyInterval")}
            </span>
          </div>
        )}

        <Input
          value={item.notes}
          onChange={(e) => onPatch(index, { notes: e.target.value })}
          placeholder={t("table.notes")}
          aria-label={t("table.notes")}
          className="w-full lg:w-40"
        />

        <div className="shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(index)}
            className="text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)]"
            aria-label={t("table.actions")}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
      <div className="mt-1 flex flex-col gap-1">
        {quantityError && (
          <p role="alert" className="text-xs text-[var(--color-danger)]">
            {quantityError}
          </p>
        )}
        {wasteError && (
          <p role="alert" className="text-xs text-[var(--color-danger)]">
            {wasteError}
          </p>
        )}
      </div>
    </div>
  );
}