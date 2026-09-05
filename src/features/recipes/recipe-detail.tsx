"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Copy, Pencil, Star, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/stores/use-toast-store";
import {
  deleteRecipeAction,
  duplicateRecipeAction,
  setDefaultRecipeAction,
  setRecipeStatusAction,
} from "@/features/recipes/actions";
import { RecipeStatusBadge, RecipeDefaultBadge } from "./recipe-badges";
import { RecipeBuilder } from "./recipe-builder";
import { resolveRecipeName } from "@/lib/recipes/translations";
import { formatRecipeCost, formatRecipeQuantityLabel } from "@/lib/recipes/format";
import type { RecipeCostBreakdown, RecipeListViewItem, RecipeWithDetail } from "@/lib/recipes/types";
import { RecipeYieldSection, type YieldRowInput } from "./recipe-yield-section";
import type { TheoreticalConsumptionResult } from "@/services/yields-service";
import type { Unit, UnitConversion } from "@/lib/units/types";

interface RecipeDetailProps {
  recipe: RecipeWithDetail | null;
  productLabel: string | null;
  canUpdate: boolean;
  canDelete: boolean;
  canActivate: boolean;
  canArchive: boolean;
  canViewCost: boolean;
  cost: RecipeCostBreakdown | null;
  versionEntries: RecipeListViewItem[];
  yieldRow?: YieldRowInput | null;
  units?: Unit[];
  conversions?: UnitConversion[];
  canEditYield?: boolean;
  canViewCostYield?: boolean;
  batchCost?: number | null;
  initialConsumption?: TheoreticalConsumptionResult | null;
}

type RecipeDialog = "activate" | "archive" | "delete" | "duplicate" | "setDefault" | null;

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] py-2.5 last:border-0">
      <dt className="text-sm text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="text-end text-sm font-medium">{children}</dd>
    </div>
  );
}

export function RecipeDetail({
  recipe,
  productLabel,
  canUpdate,
  canDelete,
  canActivate,
  canArchive,
  canViewCost,
  cost,
  versionEntries,
  yieldRow = null,
  units = [],
  conversions = [],
  canEditYield = false,
  canViewCostYield = false,
  batchCost = null,
  initialConsumption = null,
}: RecipeDetailProps) {
  const t = useTranslations("recipeDetails");
  const tn = useTranslations("navigation");
  const ta = useTranslations("recipeActions");
  const tr = useTranslations("recipeStatus");
  const ty = useTranslations("recipeYield");
  const tco = useTranslations("recipeCost");
  const tv = useTranslations("recipeVersions");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();

  const [dialog, setDialog] = useState<RecipeDialog>(null);
  const [busy, setBusy] = useState(false);

  const name = useMemo(
    () =>
      recipe ? resolveRecipeName(recipe.name, recipe.translations, locale) : "",
    [recipe, locale]
  );

  if (!recipe) {
    return null;
  }

  const formattedCreated = new Date(recipe.created_at).toLocaleDateString(locale, {
    dateStyle: "medium",
  });
  const formattedUpdated = new Date(recipe.updated_at).toLocaleDateString(locale, {
    dateStyle: "medium",
  });

  const confirm = async (
    dialogKind: Exclude<RecipeDialog, null>
  ): Promise<void> => {
    setBusy(true);
    switch (dialogKind) {
      case "activate": {
        const result = await setRecipeStatusAction({
          recipeId: recipe.id,
          status: "active",
        });
        if (result.ok) {
          toast.success({ title: ta("toastActivated") });
        } else {
          toast.error({
            title: tc("common.error"),
            description: tRoot(result.key ?? "authorization.errors.generic"),
          });
        }
        break;
      }
      case "archive": {
        const result = await setRecipeStatusAction({
          recipeId: recipe.id,
          status: "archived",
        });
        if (result.ok) {
          toast.success({ title: ta("toastArchived") });
        } else {
          toast.error({
            title: tc("common.error"),
            description: tRoot(result.key ?? "authorization.errors.generic"),
          });
        }
        break;
      }
      case "delete": {
        const result = await deleteRecipeAction({ recipeId: recipe.id });
        if (result.ok) {
          toast.success({
            title: result.data.archived ? ta("toastArchived") : ta("toastDeleted"),
          });
          router.push("/recipes");
          router.refresh();
          setBusy(false);
          return;
        }
        toast.error({
          title: tc("common.error"),
          description: tRoot(result.key ?? "authorization.errors.generic"),
        });
        break;
      }
      case "duplicate": {
        const result = await duplicateRecipeAction({ recipeId: recipe.id });
        if (result.ok) {
          toast.success({ title: ta("toastDuplicated") });
          router.push(`/recipes/${result.data.id}`);
          router.refresh();
          setBusy(false);
          return;
        }
        toast.error({
          title: tc("common.error"),
          description: tRoot(result.key ?? "authorization.errors.generic"),
        });
        break;
      }
      case "setDefault": {
        const result = await setDefaultRecipeAction({ recipeId: recipe.id });
        if (result.ok) {
          toast.success({ title: ta("toastSetDefault") });
        } else {
          toast.error({
            title: tc("common.error"),
            description: tRoot(result.key ?? "authorization.errors.generic"),
          });
        }
        break;
      }
    }
    setBusy(false);
    router.refresh();
    setDialog(null);
  };

  const dialogConfig: Record<
    Exclude<RecipeDialog, null>,
    { title: string; description: string; button: string; danger: boolean }
  > = {
    activate: {
      title: ta("activateTitle"),
      description: ta("activateDescription"),
      button: ta("activateButton"),
      danger: false,
    },
    archive: {
      title: ta("archiveTitle"),
      description: ta("archiveDescription"),
      button: ta("archiveButton"),
      danger: true,
    },
    delete: {
      title: ta("deleteTitle"),
      description: ta("deleteDescription"),
      button: ta("deleteButton"),
      danger: true,
    },
    duplicate: {
      title: ta("duplicateTitle"),
      description: ta("duplicateDescription"),
      button: ta("duplicateButton"),
      danger: false,
    },
    setDefault: {
      title: ta("setDefaultTitle"),
      description: ta("setDefaultDescription"),
      button: ta("setDefaultButton"),
      danger: true,
    },
  };

  const canEdit = canUpdate && !recipe.is_system;
  const canActivateRecipe =
    canActivate && !recipe.is_system && recipe.status !== "active";
  const canArchiveRecipe =
    canArchive && !recipe.is_system && recipe.status !== "archived";
  const canSetDefault =
    recipe.status === "active" && !recipe.is_system && !recipe.is_default;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t("title")}
        description={productLabel ?? ""}
        breadcrumbs={[
          { label: tn("recipes"), href: "/recipes" },
          { label: name },
        ]}
        actions={
          <>
            {canEdit && (
              <Link href={`/recipes/${recipe.id}/edit`}>
                <Button variant="outline">
                  <Pencil className="size-4" aria-hidden /> {ta("edit")}
                </Button>
              </Link>
            )}
            {canActivateRecipe && (
              <Button variant="success" onClick={() => setDialog("activate")}>
                <Check className="size-4" aria-hidden /> {ta("activate")}
              </Button>
            )}
            {canSetDefault && (
              <Button variant="outline" onClick={() => setDialog("setDefault")}>
                <Star className="size-4" aria-hidden /> {ta("setDefault")}
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialog("duplicate")}>
              <Copy className="size-4" aria-hidden /> {ta("duplicate")}
            </Button>
            {canArchiveRecipe && (
              <Button variant="outline" onClick={() => setDialog("archive")}>
                {ta("archive")}
              </Button>
            )}
            {canDelete && !recipe.is_system && (
              <Button variant="danger" onClick={() => setDialog("delete")}>
                <Trash2 className="size-4" aria-hidden /> {ta("delete")}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="flex flex-col gap-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{name}</h2>
              {recipe.is_system && (
                <Badge variant="primary" size="sm">
                  {tr("system")}
                </Badge>
              )}
            </div>
            {recipe.description && (
              <p className="text-sm leading-relaxed">{recipe.description}</p>
            )}
            {recipe.notes && (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {recipe.notes}
              </p>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">{t("composition")}</h3>
            <RecipeBuilder
              recipeId={recipe.id}
              defaultItems={recipe.items}
              canUpdate={false}
              readOnly
            />
          </Card>

          {canViewCost && (
            <Card className="p-5">
              <h3 className="mb-1 text-sm font-semibold">{tco("title")}</h3>
              <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
                {tco("estimateHint")}
              </p>
              {cost ? (
                <>
                  {cost.missingData && (
                    <p className="mb-3 rounded-lg border border-dashed border-[var(--color-warning)] bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)]">
                      {tco("missingData")}
                    </p>
                  )}
                  <dl className="space-y-2.5">
                    <Row label={tco("rawCost")}>
                      <span className="text-base font-semibold">
                        {formatRecipeCost(cost.rawCost, locale)}
                      </span>
                    </Row>
                    <Row label={tco("perUnit")}>
                      {formatRecipeCost(
                        cost.rawCost !== null
                          ? cost.rawCost / (Number(recipe.default_yield) || 1)
                          : null,
                        locale
                      )}
                    </Row>
                  </dl>
                  <div className="mt-4 overflow-hidden rounded-lg border border-[var(--color-border)]">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--color-muted)] text-xs text-[var(--color-muted-foreground)]">
                        <tr>
                          <th scope="col" className="px-3 py-2 text-start">
                            {tco("quantity")}
                          </th>
                          <th scope="col" className="px-3 py-2 text-start">
                            {tco("unit")}
                          </th>
                          <th scope="col" className="px-3 py-2 text-start">
                            {tco("contribution")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--color-border)]">
                        {cost.items.map((item) => (
                          <tr key={item.itemId}>
                            <td className="whitespace-nowrap px-3 py-2">
                              {formatRecipeQuantityLabel(
                                item.quantity,
                                item.unitSymbol,
                                locale
                              )}
                            </td>
                            <td className="px-3 py-2 text-[var(--color-muted-foreground)]">
                              {item.label}
                            </td>
                            <td className="px-3 py-2 text-end font-medium">
                              {formatRecipeCost(item.contribution, locale)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : null}
            </Card>
          )}

          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">{t("versions")}</h3>
            {versionEntries.length === 0 ? (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                {tv("empty")}
              </p>
            ) : (
              <ul className="divide-y divide-[var(--color-border)]">
                {versionEntries.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="muted" size="sm">
                        {tv("version", { version: entry.version })}
                      </Badge>
                      {entry.is_default && <RecipeDefaultBadge />}
                      <RecipeStatusBadge status={entry.status} />
                    </div>
                    <div className="flex items-center gap-3">
                      {entry.id === recipe.id ? (
                        <span className="text-xs font-medium text-[var(--color-primary)]">
                          {tv("current")}
                        </span>
                      ) : (
                        <Link
                          href={`/recipes/${entry.id}`}
                          className="text-xs font-medium text-[var(--color-primary)] hover:underline"
                        >
                          {tv("view")}
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <RecipeYieldSection
            recipeId={recipe.id}
            row={yieldRow}
            units={units}
            conversions={conversions}
            canEdit={canEditYield}
            canViewCost={canViewCostYield}
            batchCost={batchCost}
            initialConsumption={initialConsumption}
          />

          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">{t("dates")}</h3>
            <dl>
              <Row label={t("created")}>{formattedCreated}</Row>
              <Row label={t("updated")}>{formattedUpdated}</Row>
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">{t("general")}</h3>
            <dl>
              <Row label={t("product")}>{productLabel ?? "—"}</Row>
              <Row label={t("version")}>
                <Badge variant="muted" size="sm">
                  {recipe.version}
                </Badge>
              </Row>
              <Row label={t("status")}>
                <span className="inline-flex items-center gap-1.5">
                  <RecipeStatusBadge status={recipe.status} />
                  {recipe.is_default && <RecipeDefaultBadge />}
                </span>
              </Row>
              <Row label={t("yieldType")}>{ty(recipe.yield_type)}</Row>
              <Row label={t("yieldValue")}>
                {formatRecipeQuantityLabel(Number(recipe.default_yield), null, locale)}
              </Row>
              <Row label={t("preparationTime")}>
                {recipe.preparation_time != null
                  ? t("minutes", { count: recipe.preparation_time })
                  : "—"}
              </Row>
            </dl>
          </Card>
        </div>
      </div>

      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog ? dialogConfig[dialog].title : ""}
        description={dialog ? dialogConfig[dialog].description : undefined}
        footer={
          <>
            <Button variant="outline" onClick={() => setDialog(null)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant={dialog && dialogConfig[dialog].danger ? "danger" : "primary"}
              loading={busy}
              onClick={() => dialog && void confirm(dialog)}
            >
              {dialog ? dialogConfig[dialog].button : ""}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">{name}</p>
      </Dialog>
    </div>
  );
}