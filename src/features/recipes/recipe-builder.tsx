"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Save, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/stores/use-toast-store";
import { saveRecipeItemsAction } from "@/features/recipes/actions";
import { RecipeItemRow, type RecipeBuilderItem } from "./recipe-item-row";
import { parseRecipeDecimal } from "@/lib/recipes/formatters";
import { formatRecipeCost, formatRecipeQuantityLabel } from "@/lib/recipes/format";
import type { Unit, UnitConversion } from "@/lib/units/types";
import type { IngredientSelectorEntry } from "@/lib/ingredients/types";
import type { RecipeSelectorEntry } from "@/lib/recipes/types";
import type {
  RecipeCostBreakdown,
  RecipeItemWithRefs,
} from "@/lib/recipes/types";

interface RecipeBuilderProps {
  recipeId: string;
  defaultItems?: RecipeItemWithRefs[];
  canUpdate: boolean;
  readOnly?: boolean;
  canViewCost?: boolean;
  initialCost?: RecipeCostBreakdown | null;
  units?: Unit[];
  conversions?: UnitConversion[];
}

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `rb-item-${keyCounter}`;
}

function toBuilderItems(items: RecipeItemWithRefs[] | undefined): RecipeBuilderItem[] {
  return (items ?? []).map((item, index) => ({
    key: item.id ?? nextKey(),
    refType: item.sub_recipe_id ? "subRecipe" : "ingredient",
    refId: item.ingredient_id ?? item.sub_recipe_id,
    refLabel: item.sub_recipe_id
      ? (item.subRecipeName ?? item.sub_recipe_id)
      : (item.ingredientName ?? item.ingredient_id ?? ""),
    ingredientBaseUnitId: item.ingredientBaseUnitId,
    quantity: String(item.quantity),
    unitId: item.unit_id,
    wastePercentage: String(item.waste_percentage),
    notes: item.notes ?? "",
    sortOrder: (index + 1) * 10,
  }));
}

type ItemErrors = Record<string, Record<string, string | undefined>>;

export function RecipeBuilder({
  recipeId,
  defaultItems,
  canUpdate,
  readOnly = false,
  canViewCost = false,
  initialCost = null,
  units = [],
  conversions = [],
}: RecipeBuilderProps) {
  const t = useTranslations("recipeBuilder");
  const tv = useTranslations("recipeValidation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();

  const [items, setItems] = useState<RecipeBuilderItem[]>(() =>
    toBuilderItems(defaultItems)
  );
  const [errors, setErrors] = useState<ItemErrors>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  const costByIndex = useMemo(() => {
    const map = new Map<number, number | null>();
    (initialCost?.items ?? []).forEach((entry, index) => {
      map.set(index, entry.contribution);
    });
    return map;
  }, [initialCost]);

  function patch(index: number, patch: Partial<RecipeBuilderItem>) {
    const key = items[index].key;
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item))
    );
    setErrors((prev) => ({ ...prev, [key]: {} }));
    setDirty(true);
  }

  function removeAt(index: number) {
    const key = items[index].key;
    setItems((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setDirty(true);
  }

  function addIngredient() {
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        refType: "ingredient",
        refId: null,
        refLabel: "",
        ingredientBaseUnitId: null,
        quantity: "",
        unitId: null,
        wastePercentage: "",
        notes: "",
        sortOrder: (prev.length + 1) * 10,
      },
    ]);
    setDirty(true);
  }

  function addSubRecipe() {
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        refType: "subRecipe",
        refId: null,
        refLabel: "",
        ingredientBaseUnitId: null,
        quantity: "",
        unitId: null,
        wastePercentage: "",
        notes: "",
        sortOrder: (prev.length + 1) * 10,
      },
    ]);
    setDirty(true);
  }

  function selectIngredient(index: number, entry: IngredientSelectorEntry) {
    patch(index, {
      refId: entry.id,
      refLabel: entry.name,
      ingredientBaseUnitId: entry.baseUnitId,
      unitId: null,
    });
  }

  function selectSubRecipe(index: number, entry: RecipeSelectorEntry) {
    patch(index, {
      refId: entry.id,
      refLabel: entry.name,
    });
  }

  async function save() {
    const next: ItemErrors = {};
    const seenIngredients = new Set<string>();
    const seenSubRecipes = new Set<string>();
    let hasError = false;

    items.forEach((item) => {
      const errs: Record<string, string | undefined> = {};
      if (!item.refId) {
        errs.ref = tv("itemRefRequired");
      } else if (item.refType === "ingredient") {
        if (seenIngredients.has(item.refId)) errs.ref = tv("duplicateItem");
        seenIngredients.add(item.refId);
      } else {
        if (seenSubRecipes.has(item.refId)) errs.ref = tv("duplicateItem");
        seenSubRecipes.add(item.refId);
      }
      const quantity = parseRecipeDecimal(item.quantity);
      if (quantity === null || quantity <= 0) errs.quantity = tc("common.invalid");
      const waste =
        item.wastePercentage.trim() === ""
          ? 0
          : parseRecipeDecimal(item.wastePercentage);
      if (waste === null || waste < 0 || waste > 100) {
        errs.waste = tc("common.invalid");
      }
      if (Object.keys(errs).length > 0) {
        hasError = true;
        next[item.key] = errs;
      }
    });

    setErrors(next);
    if (hasError) return;

    if (items.length === 0) {
      toast.error({
        title: tc("common.error"),
        description: tv("empty"),
      });
      return;
    }

    setBusy(true);
    const payload = items.map((item, index) => ({
      ingredientId: item.refType === "ingredient" ? item.refId : null,
      subRecipeId: item.refType === "subRecipe" ? item.refId : null,
      quantity: parseRecipeDecimal(item.quantity) ?? 0,
      unitId: item.unitId,
      wastePercentage:
        item.wastePercentage.trim() === ""
          ? 0
          : (parseRecipeDecimal(item.wastePercentage) ?? 0),
      notes: item.notes.trim() === "" ? null : item.notes.trim(),
      sortOrder: item.sortOrder || (index + 1) * 10,
    }));

    const result = await saveRecipeItemsAction({ recipeId, items: payload });
    setBusy(false);
    if (result.ok) {
      toast.success({ title: t("saved") });
      setDirty(false);
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  if (readOnly || !canUpdate) {
    return (
      <ReadOnlyComposition
        items={defaultItems ?? []}
        canViewCost={canViewCost}
        costByIndex={costByIndex}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{t("title")}</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-muted-foreground)]">
            {t("itemCount", { count: items.length })}
          </span>
          {dirty && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-warning)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-warning)]">
              <ShieldAlert className="size-3" aria-hidden />
              {t("unsaved")}
            </span>
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState title={t("empty")} description={t("emptyHint")} />
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <RecipeItemRow
              key={item.key}
              item={item}
              index={index}
              units={units}
              conversions={conversions}
              canViewCost={canViewCost}
              costContribution={costByIndex.get(index)}
              errors={errors[item.key]}
              onPatch={patch}
              onSelectIngredient={selectIngredient}
              onSelectSubRecipe={selectSubRecipe}
              onRemove={removeAt}
              locale={locale}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
            <Plus className="size-4" aria-hidden /> {t("addIngredient")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addSubRecipe}>
            <Plus className="size-4" aria-hidden /> {t("addSubRecipe")}
          </Button>
        </div>
        <Button onClick={save} loading={busy}>
          <Save className="size-4" aria-hidden /> {t("save")}
        </Button>
      </div>
    </div>
  );
}

function ReadOnlyComposition({
  items,
  canViewCost,
  costByIndex,
}: {
  items: RecipeItemWithRefs[];
  canViewCost: boolean;
  costByIndex: Map<number, number | null>;
}) {
  const t = useTranslations("recipeBuilder");
  const locale = useLocale();

  if (items.length === 0) {
    return <EmptyState title={t("empty")} description={t("emptyHint")} />;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead className="bg-[var(--color-muted)] text-xs text-[var(--color-muted-foreground)]">
          <tr>
            <th scope="col" className="px-3 py-2 text-start">#</th>
            <th scope="col" className="px-3 py-2 text-start">{t("table.item")}</th>
            <th scope="col" className="px-3 py-2 text-start">{t("table.quantity")}</th>
            {canViewCost && (
              <th scope="col" className="px-3 py-2 text-end">{t("table.cost")}</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {items.map((item, index) => (
            <tr key={item.id ?? index}>
              <td className="px-3 py-2 text-[var(--color-muted-foreground)]">
                {index + 1}
              </td>
              <td className="min-w-0 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">
                    {item.sub_recipe_id
                      ? (item.subRecipeName ?? item.sub_recipe_id)
                      : (item.ingredientName ?? item.ingredient_id ?? "—")}
                  </span>
                  {item.sub_recipe_id && (
                    <Badge variant="outline" size="sm">
                      {t("subRecipeBadge")}
                    </Badge>
                  )}
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-[var(--color-muted-foreground)]">
                {formatRecipeQuantityLabel(
                  Number(item.quantity),
                  item.unitSymbol,
                  locale
                )}
                {item.waste_percentage > 0 && (
                  <span className="ms-1 text-xs">({item.waste_percentage}%)</span>
                )}
              </td>
              {canViewCost && (
                <td className="whitespace-nowrap px-3 py-2 text-end font-medium">
                  {formatRecipeCost(
                    costByIndex.has(index) ? (costByIndex.get(index) ?? null) : null,
                    locale
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}