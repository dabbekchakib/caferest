"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/stores/use-toast-store";
import { deleteIngredientAction } from "@/features/ingredients/actions";
import { IngredientImage } from "./ingredient-image";
import { IngredientBadges } from "./ingredient-badges";
import { resolveIngredientName } from "@/lib/ingredients/translations";
import { formatCost } from "@/lib/ingredients/formatters";
import type { IngredientWithTranslations } from "@/lib/ingredients/types";

interface IngredientDetailProps {
  ingredient: IngredientWithTranslations;
  categoryLabel: string | null;
  baseUnitLabel: string | null;
  purchaseUnitLabel: string | null;
  costPerBaseUnit: number | null;
  canUpdate: boolean;
  canDelete: boolean;
  /** Recipes referencing this ingredient (server-rendered section). */
  recipeSection?: React.ReactNode;
  /** Supplier catalog section for this ingredient. */
  suppliersSection?: React.ReactNode;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] py-2.5 last:border-0">
      <dt className="text-sm text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="text-end text-sm font-medium">{children}</dd>
    </div>
  );
}

export function IngredientDetail({
  ingredient,
  categoryLabel,
  baseUnitLabel,
  purchaseUnitLabel,
  costPerBaseUnit,
  canUpdate,
  canDelete,
  recipeSection,
  suppliersSection,
}: IngredientDetailProps) {
  const t = useTranslations("ingredients");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const name = useMemo(
    () =>
      resolveIngredientName(ingredient.name, ingredient.translations, locale),
    [ingredient, locale]
  );

  async function remove() {
    setBusy(true);
    const result = await deleteIngredientAction({ ingredientId: ingredient.id });
    setBusy(false);
    if (result.ok) {
      toast.success({ title: t("success.deleted") });
      router.push("/ingredients");
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
      setOpen(false);
    }
  }

  const editable = canUpdate && !ingredient.is_system;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t("detailTitle")}
        description={ingredient.description || t("description")}
        breadcrumbs={[
          { label: tn("ingredients"), href: "/ingredients" },
          { label: name },
        ]}
        actions={
          <>
            {editable && (
              <Link href={`/ingredients/${ingredient.id}/edit`}>
                <Button variant="outline">
                  <Pencil className="size-4" aria-hidden /> {t("actions.edit")}
                </Button>
              </Link>
            )}
            {canDelete && !ingredient.is_system && (
              <Button variant="danger" onClick={() => setOpen(true)}>
                <Trash2 className="size-4" aria-hidden /> {t("actions.delete")}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="flex flex-col gap-4 p-5 sm:flex-row">
            <IngredientImage
              src={ingredient.image_url}
              alt={name}
              className="size-40 shrink-0"
            />
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{name}</h2>
                <IngredientBadges ingredient={ingredient} />
              </div>
              {ingredient.description && (
                <p className="text-sm leading-relaxed">
                  {ingredient.description}
                </p>
              )}
            </div>
          </Card>

          {ingredient.is_stock_tracked && (
            <Card className="p-5">
              <h3 className="mb-2 text-sm font-semibold">{t("details.stock")}</h3>
              <div className="flex items-center justify-between rounded-lg border border-dashed border-[var(--color-border)] p-4">
                <span className="text-sm text-[var(--color-muted-foreground)]">
                  {t("badges.stockTracked")}
                </span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {t("details.futureSection")}
                </span>
              </div>
            </Card>
          )}

          {recipeSection}

          {suppliersSection}

          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">{t("details.dates")}</h3>
            <dl>
              <Row label={t("details.created")}>
                {new Date(ingredient.created_at).toLocaleDateString(locale, {
                  dateStyle: "medium",
                })}
              </Row>
              <Row label={t("details.updated")}>
                {new Date(ingredient.updated_at).toLocaleDateString(locale, {
                  dateStyle: "medium",
                })}
              </Row>
            </dl>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">
              {t("details.classification")}
            </h3>
            <dl>
              <Row label={t("details.general")}>
                {t(`types.${ingredient.ingredient_type}`)}
              </Row>
              <Row label={t("form.categoryLabel")}>
                {categoryLabel ?? "—"}
              </Row>
              <Row label={t("form.baseUnitLabel")}>
                {baseUnitLabel ?? "—"}
              </Row>
              <Row label={t("form.purchaseUnitLabel")}>
                {purchaseUnitLabel ?? "—"}
              </Row>
              <Row label={t("form.slugLabel")}>{ingredient.slug}</Row>
              <Row label={t("form.sortOrderLabel")}>
                {ingredient.sort_order}
              </Row>
              <Row label={t("form.skuLabel")}>
                {ingredient.sku ?? t("details.noSku")}
              </Row>
              <Row label={t("form.barcodeLabel")}>
                {ingredient.barcode ?? t("details.noBarcode")}
              </Row>
            </dl>
          </Card>

          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">{t("details.purchase")}</h3>
            <dl>
              <Row label={t("form.purchaseQuantityLabel")}>
                {ingredient.purchase_quantity}
              </Row>
              <Row label={t("form.purchaseCostLabel")}>
                <span className="text-base font-semibold">
                  {formatCost(ingredient.purchase_cost, locale)} TND
                </span>
              </Row>
              <Row label={t("details.costPerUnit")}>
                {costPerBaseUnit !== null
                  ? `${formatCost(costPerBaseUnit, locale)} TND`
                  : "—"}
              </Row>
              <Row label={t("form.wasteLabel")}>
                {`${ingredient.waste_percentage} %`}
              </Row>
            </dl>
          </Card>
        </div>
      </div>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={t("dialogs.deleteTitle")}
        description={t("dialogs.deleteDescription")}
        footer={
          <>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {tc("common.cancel")}
            </Button>
            <Button variant="danger" loading={busy} onClick={remove}>
              {t("dialogs.confirmDelete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">{name}</p>
      </Dialog>
    </div>
  );
}