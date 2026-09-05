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
import { deleteProductAction } from "@/features/products/actions";
import { ProductImage } from "./product-image";
import { ProductBadges } from "./product-badges";
import { resolveProductName, resolveProductShortDescription } from "@/lib/products/translations";
import { formatCurrency } from "@/lib/format";
import type { ProductWithTranslations } from "@/lib/products/types";

interface ProductDetailProps {
  product: ProductWithTranslations;
  categoryLabel: string | null;
  unitName: string | null;
  taxLabel: string | null;
  canUpdate: boolean;
  canDelete: boolean;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] py-2.5 last:border-0">
      <dt className="text-sm text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="text-end text-sm font-medium">{children}</dd>
    </div>
  );
}

export function ProductDetail({
  product,
  categoryLabel,
  unitName,
  taxLabel,
  canUpdate,
  canDelete,
}: ProductDetailProps) {
  const t = useTranslations("products");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const name = useMemo(
    () => resolveProductName(product.name, product.translations, locale),
    [product, locale]
  );
  const short = useMemo(
    () =>
      resolveProductShortDescription(
        product.short_description ?? null,
        product.translations,
        locale
      ),
    [product, locale]
  );

  async function remove() {
    setBusy(true);
    const result = await deleteProductAction({ productId: product.id });
    setBusy(false);
    if (result.ok) {
      toast.success({ title: t("success.deleted") });
      router.push("/products");
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
      setOpen(false);
    }
  }

  const editable = canUpdate && !product.is_system;

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={t("detailTitle")}
        description={short || t("description")}
        breadcrumbs={[
          { label: tn("products"), href: "/products" },
          { label: name },
        ]}
        actions={
          <>
            {editable && (
              <Link href={`/products/${product.id}/edit`}>
                <Button variant="outline">
                  <Pencil className="size-4" aria-hidden /> {t("actions.edit")}
                </Button>
              </Link>
            )}
            {canDelete && !product.is_system && (
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
            <ProductImage
              src={product.image_url}
              alt={name}
              className="size-40 shrink-0"
            />
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{name}</h2>
                <ProductBadges product={product} />
              </div>
              {product.short_description && (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {short}
                </p>
              )}
              {product.description && (
                <p className="text-sm leading-relaxed">{product.description}</p>
              )}
            </div>
          </Card>

          {product.product_type === "composite" && (
            <Card className="p-5">
              <h3 className="mb-2 text-sm font-semibold">
                {t("details.recipe")}
              </h3>
              <p className="mb-2 text-sm text-[var(--color-muted-foreground)]">
                {t("details.costUpcoming")}
              </p>
              <div className="flex items-center justify-between rounded-lg border border-dashed border-[var(--color-border)] p-4">
                <span className="text-sm text-[var(--color-muted-foreground)]">
                  {t("details.ingredients")}
                </span>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {t("details.futureSection")}
                </span>
              </div>
            </Card>
          )}

          {product.is_stock_tracked && (
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

          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">{t("details.dates")}</h3>
            <dl>
              <Row label={t("details.created")}>
                {new Date(product.created_at).toLocaleDateString(locale, {
                  dateStyle: "medium",
                })}
              </Row>
              <Row label={t("details.updated")}>
                {new Date(product.updated_at).toLocaleDateString(locale, {
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
              <Row label={t("details.general")}>{t(`types.${product.product_type}`)}</Row>
              <Row label={t("form.categoryLabel")}>{categoryLabel ?? "—"}</Row>
              <Row label={t("form.unitLabel")}>{unitName ?? "—"}</Row>
              <Row label={t("form.slugLabel")}>{product.slug}</Row>
              <Row label={t("form.sortOrderLabel")}>{product.sort_order}</Row>
              <Row label={t("form.skuLabel")}>{product.sku ?? t("details.noSku")}</Row>
              <Row label={t("form.barcodeLabel")}>
                {product.barcode ?? t("details.noBarcode")}
              </Row>
            </dl>
          </Card>

          <Card className="p-5">
            <h3 className="mb-2 text-sm font-semibold">{t("details.pricing")}</h3>
            <dl>
              <Row label={t("form.priceLabel")}>
                <span className="text-base font-semibold">
                  {formatCurrency(product.price)}
                </span>
              </Row>
              <Row label={t("details.cost")}>
                {product.cost != null && product.cost > 0
                  ? formatCurrency(product.cost)
                  : "—"}
              </Row>
              <Row label={t("form.taxLabel")}>{taxLabel ?? "—"}</Row>
            </dl>
            {product.is_stock_tracked && (
              <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">
                {t("details.costUpcoming")}
              </p>
            )}
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