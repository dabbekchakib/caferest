"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Pencil, Plus, Star, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/stores/use-toast-store";
import {
  addIngredientSupplierAction,
  updateIngredientSupplierAction,
  removeIngredientSupplierAction,
  setPreferredSupplierAction,
} from "@/features/suppliers/actions";
import { calculateNormalizedPurchaseCost } from "@/lib/suppliers/calculations";
import { formatCost, parseDecimal } from "@/lib/ingredients/formatters";
import type { SupplierCatalogItem } from "@/lib/suppliers/types";
import type { Unit, UnitConversion } from "@/lib/units/types";

const CURRENCIES = ["TND", "EUR", "USD", "GBP", "CHF", "SAR", "AED", "DZD", "MAD"] as const;

interface IngredientSuppliersSectionProps {
  ingredientId: string;
  baseUnitId: string | null;
  baseUnitSymbol: string | null;
  items: SupplierCatalogItem[];
  suppliers: { id: string; name: string; code: string | null }[];
  units: Unit[];
  conversions: UnitConversion[];
  canManageCatalog: boolean;
  canViewPrices: boolean;
  canUpdatePrices: boolean;
}

export function IngredientSuppliersSection({
  ingredientId,
  baseUnitId,
  baseUnitSymbol,
  items,
  suppliers,
  units,
  conversions,
  canManageCatalog,
  canViewPrices,
  canUpdatePrices,
}: IngredientSuppliersSectionProps) {
  const t = useTranslations("supplierCatalog");
  const ts = useTranslations("suppliers");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ mode: "add" } | { mode: "edit"; item: SupplierCatalogItem } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<SupplierCatalogItem | null>(null);
  const [busy, setBusy] = useState(false);

  const unitLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const unit of units) {
      map.set(unit.id, unit.symbol ? `${unit.name} (${unit.symbol})` : unit.name);
    }
    return map;
  }, [units]);

  async function run(action: () => Promise<{ ok: boolean; key?: string }>, successTitle: string) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result.ok) {
      toast.success({ title: successTitle });
      setDialog(null);
      setRemoveTarget(null);
      return true;
    }
    toast.error({
      title: tc("common.error"),
      description: tRoot(result.key ?? "authorization.errors.generic"),
    });
    return false;
  }

  const columns: Column<SupplierCatalogItem>[] = [
    {
      key: "supplier",
      header: ts("name"),
      accessor: (item) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{item.supplierName}</span>
          {item.supplierCode && (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {item.supplierCode}
            </span>
          )}
        </span>
      ),
      sortable: true,
      sortValue: (item) => item.supplierName,
    },
    {
      key: "sku",
      header: t("columns.sku"),
      accessor: (item) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {item.supplier_sku ?? "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "purchase",
      header: t("columns.purchaseUnit"),
      accessor: (item) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {`${formatCost(Number(item.purchase_quantity), locale)} ${item.purchaseUnitSymbol ?? ""}`.trim()}
        </span>
      ),
      hideOnMobile: true,
    },
    ...(canViewPrices
      ? [
          {
            key: "price",
            header: t("columns.price"),
            accessor: (item: SupplierCatalogItem) => (
              <span className="text-sm font-medium">
                {`${formatCost(Number(item.purchase_price), locale)} ${item.currency_code}`}
              </span>
            ),
            sortable: true,
            sortValue: (item: SupplierCatalogItem) => Number(item.purchase_price),
          },
          {
            key: "normalized",
            header: t("columns.normalizedCost"),
            accessor: (item: SupplierCatalogItem) =>
              item.normalizedCost ? (
                <span className="text-sm text-[var(--color-muted-foreground)]">
                  {`${formatCost(item.normalizedCost.amount, locale)} ${item.currency_code} / ${item.normalizedCost.baseUnitSymbol ?? "?"}`}
                </span>
              ) : (
                <span className="text-sm text-[var(--color-muted-foreground)]">—</span>
              ),
            hideOnMobile: true,
          },
        ]
      : []),
    {
      key: "status",
      header: t("columns.active"),
      accessor: (item) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {item.is_preferred && <Badge size="sm">{t("preferred")}</Badge>}
          {!item.is_active && (
            <Badge variant="danger" size="sm" dot>
              {ts("inactive")}
            </Badge>
          )}
        </span>
      ),
    },
    ...(canManageCatalog
      ? [
          {
            key: "actions",
            header: tc("common.actions"),
            accessor: (item: SupplierCatalogItem) => (
              <div className="flex items-center gap-0.5">
                {!item.is_preferred && item.is_active && (
                  <button
                    type="button"
                    onClick={() =>
                      void run(
                        () => setPreferredSupplierAction({ ingredientSupplierId: item.id }),
                        t("preferred")
                      )
                    }
                    className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                    aria-label={t("makePreferred")}
                  >
                    <Star className="size-4" aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDialog({ mode: "edit", item })}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]"
                  aria-label={t("edit")}
                >
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setRemoveTarget(item)}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-danger)]"
                  aria-label={t("remove")}
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{ts("suppliersForIngredient")}</h3>
        {canManageCatalog && (
          <Button size="sm" onClick={() => setDialog({ mode: "add" })}>
            <Plus className="size-4" aria-hidden /> {t("add")}
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-sm text-[var(--color-muted-foreground)]">
          {ts("noSuppliersForIngredient")}
        </p>
      ) : (
        <DataTable columns={columns} data={items} rowKey={(item) => item.id} striped />
      )}

      {dialog && (
        <IngredientItemDialog
          dialog={dialog}
          ingredientId={ingredientId}
          baseUnitId={baseUnitId}
          baseUnitSymbol={baseUnitSymbol}
          suppliers={suppliers}
          units={units}
          unitLabels={unitLabels}
          conversions={conversions}
          canUpdatePrices={canUpdatePrices}
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={async (payload) =>
            run(
              () =>
                dialog.mode === "add"
                  ? addIngredientSupplierAction({
                      ingredientId,
                      supplierId: payload.supplierId ?? "",
                      ...payload,
                      purchaseUnitId: payload.purchaseUnitId ?? "",
                      purchaseQuantity: payload.purchaseQuantity ?? 0,
                      purchasePrice: payload.purchasePrice ?? 0,
                      currencyCode: payload.currencyCode ?? "TND",
                    })
                  : updateIngredientSupplierAction({
                      ingredientSupplierId: dialog.item.id,
                      ingredientId,
                      supplierId: dialog.item.supplier_id,
                      ...payload,
                    }),
              dialog.mode === "add" ? t("added") : t("saved")
            )
          }
        />
      )}

      <Dialog
        open={removeTarget !== null}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title={t("removeTitle")}
        description={t("removeBody")}
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                removeTarget &&
                void run(
                  () => removeIngredientSupplierAction({ ingredientSupplierId: removeTarget.id }),
                  t("removed")
                )
              }
            >
              {tc("common.delete")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {removeTarget?.supplierName}
        </p>
      </Dialog>
    </Card>
  );
}

interface IngredientItemPayload {
  supplierId?: string;
  purchaseUnitId?: string;
  purchaseQuantity?: number;
  purchasePrice?: number;
  currencyCode?: string;
  minimumOrderQuantity?: number | null;
  leadTimeDays?: number | null;
  supplierSku?: string | null;
  supplierBarcode?: string | null;
  isPreferred: boolean;
  isActive?: boolean | null;
  notes?: string | null;
}

function IngredientItemDialog({
  dialog,
  baseUnitId,
  baseUnitSymbol,
  suppliers,
  units,
  unitLabels,
  conversions,
  canUpdatePrices,
  busy,
  onClose,
  onSubmit,
}: {
  dialog: { mode: "add" } | { mode: "edit"; item: SupplierCatalogItem };
  ingredientId: string;
  baseUnitId: string | null;
  baseUnitSymbol: string | null;
  suppliers: { id: string; name: string; code: string | null }[];
  units: Unit[];
  unitLabels: Map<string, string>;
  conversions: UnitConversion[];
  canUpdatePrices: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (payload: IngredientItemPayload) => Promise<boolean>;
}) {
  const t = useTranslations("supplierCatalog");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const locale = useLocale();
  const edit = dialog.mode === "edit" ? dialog.item : null;

  const [supplierId, setSupplierId] = useState(edit?.supplier_id ?? "");
  const [purchaseUnitId, setPurchaseUnitId] = useState(edit?.purchase_unit_id ?? "");
  const [purchaseQuantity, setPurchaseQuantity] = useState(edit ? String(edit.purchase_quantity) : "1");
  const [purchasePrice, setPurchasePrice] = useState(edit ? String(edit.purchase_price) : "");
  const [currencyCode, setCurrencyCode] = useState(edit?.currency_code ?? "TND");
  const [minimumOrderQuantity, setMinimumOrderQuantity] = useState(
    edit?.minimum_order_quantity != null ? String(edit.minimum_order_quantity) : ""
  );
  const [leadTimeDays, setLeadTimeDays] = useState(edit?.lead_time_days != null ? String(edit.lead_time_days) : "");
  const [supplierSku, setSupplierSku] = useState(edit?.supplier_sku ?? "");
  const [supplierBarcode, setSupplierBarcode] = useState(edit?.supplier_barcode ?? "");
  const [isPreferred, setIsPreferred] = useState(edit?.is_preferred ?? false);
  const [isActive, setIsActive] = useState(edit?.is_active ?? true);
  const [notes, setNotes] = useState(edit?.notes ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const preview = useMemo(() => {
    if (dialog.mode === "add" && !supplierId) return null;
    const price = parseDecimal(purchasePrice);
    const qty = parseDecimal(purchaseQuantity);
    if (price === null || qty === null || price < 0 || qty <= 0) return null;
    if (!purchaseUnitId || !baseUnitId) return null;
    return calculateNormalizedPurchaseCost({
      purchasePrice: price,
      purchaseQuantity: qty,
      purchaseUnitId,
      baseUnitId,
      conversions,
      baseUnitSymbol,
    });
  }, [dialog.mode, supplierId, purchasePrice, purchaseQuantity, purchaseUnitId, baseUnitId, baseUnitSymbol, conversions]);

  async function submit() {
    const errs: Record<string, string> = {};
    if (dialog.mode === "add" && !supplierId) {
      errs.supplier = tRoot("supplierValidation.supplierRequired");
    }
    if (!purchaseUnitId) {
      errs.purchaseUnit = tRoot("supplierValidation.purchaseUnitRequired");
    }
    const qty = parseDecimal(purchaseQuantity);
    if (qty === null || qty <= 0) {
      errs.quantity = tRoot("supplierValidation.quantityPositive");
    }
    const price = parseDecimal(purchasePrice);
    if (price === null || price < 0) {
      errs.price = tRoot("supplierValidation.pricePositive");
    }
    if (!currencyCode.trim()) {
      errs.currency = tRoot("supplierValidation.currencyRequired");
    }
    const minOrder = parseDecimal(minimumOrderQuantity);
    if (minOrder !== null && minOrder < 0) {
      errs.minimumOrder = tRoot("supplierValidation.minimumOrderPositive");
    }
    const leadTime = parseDecimal(leadTimeDays);
    if (leadTime !== null && leadTime < 0) {
      errs.leadTime = tRoot("supplierValidation.leadTimePositive");
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const payload: IngredientItemPayload = {
      minimumOrderQuantity: minOrder,
      leadTimeDays: leadTime,
      supplierSku: supplierSku.trim() || null,
      supplierBarcode: supplierBarcode.trim() || null,
      isPreferred,
      notes: notes.trim() || null,
    };
    if (dialog.mode === "add" || canUpdatePrices) {
      payload.purchaseUnitId = purchaseUnitId;
      payload.purchaseQuantity = qty ?? 1;
      payload.purchasePrice = price ?? 0;
      payload.currencyCode = currencyCode.trim().toUpperCase();
    }
    if (dialog.mode === "add") {
      payload.supplierId = supplierId;
    } else {
      payload.isActive = isActive;
    }
    await onSubmit(payload);
  }

  const priceDisabled = dialog.mode === "edit" && !canUpdatePrices;

  return (
    <Dialog
      open
      onOpenChange={(openAsync) => !openAsync && onClose()}
      title={dialog.mode === "add" ? t("addTitle") : t("editTitle")}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {tc("common.cancel")}
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            {tc("common.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {dialog.mode === "add" ? (
          <Field label={t("fields.ingredient")} htmlFor="ing-item-supplier" required error={errors.supplier}>
            <Select
              id="ing-item-supplier"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
            >
              <option value="">{t("fields.searchIngredient")}</option>
              {suppliers.map((supplierRow) => (
                <option key={supplierRow.id} value={supplierRow.id}>
                  {supplierRow.name}
                  {supplierRow.code ? ` (${supplierRow.code})` : ""}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <p className="text-sm font-medium">{edit?.supplierName}</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("fields.supplierSku")} htmlFor="ing-item-sku">
            <Input id="ing-item-sku" value={supplierSku} onChange={(e) => setSupplierSku(e.target.value)} />
          </Field>
          <Field label={t("fields.supplierBarcode")} htmlFor="ing-item-barcode">
            <Input id="ing-item-barcode" value={supplierBarcode} onChange={(e) => setSupplierBarcode(e.target.value)} />
          </Field>
          <Field label={t("fields.purchaseUnit")} htmlFor="ing-item-unit" required error={errors.purchaseUnit}>
            <Select
              id="ing-item-unit"
              value={purchaseUnitId}
              disabled={priceDisabled}
              onChange={(e) => setPurchaseUnitId(e.target.value)}
            >
              <option value="">{tc("common.none")}</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unitLabels.get(unit.id) ?? unit.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.purchaseQuantity")} htmlFor="ing-item-qty" required error={errors.quantity}>
            <Input
              id="ing-item-qty"
              inputMode="decimal"
              value={purchaseQuantity}
              disabled={priceDisabled}
              onChange={(e) => setPurchaseQuantity(e.target.value)}
            />
          </Field>
          <Field label={t("fields.purchasePrice")} htmlFor="ing-item-price" required error={errors.price}>
            <Input
              id="ing-item-price"
              inputMode="decimal"
              value={purchasePrice}
              disabled={priceDisabled}
              onChange={(e) => setPurchasePrice(e.target.value)}
            />
          </Field>
          <Field label={t("fields.currencyCode")} htmlFor="ing-item-currency" required error={errors.currency}>
            <Select
              id="ing-item-currency"
              value={currencyCode}
              disabled={priceDisabled}
              onChange={(e) => setCurrencyCode(e.target.value)}
            >
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("fields.minimumOrderQuantity")} htmlFor="ing-item-min" error={errors.minimumOrder}>
            <Input
              id="ing-item-min"
              inputMode="decimal"
              value={minimumOrderQuantity}
              onChange={(e) => setMinimumOrderQuantity(e.target.value)}
            />
          </Field>
          <Field label={t("fields.leadTimeDays")} htmlFor="ing-item-lead" error={errors.leadTime}>
            <Input
              id="ing-item-lead"
              inputMode="numeric"
              value={leadTimeDays}
              onChange={(e) => setLeadTimeDays(e.target.value)}
            />
          </Field>
        </div>

        {priceDisabled && (
          <p className="text-xs text-[var(--color-muted-foreground)]">{t("priceReadOnly")}</p>
        )}

        {preview && (
          <p className="text-sm">
            <span className="text-[var(--color-muted-foreground)]">
              {t("normalizedCostHint")} →
            </span>{" "}
            <span className="font-semibold">
              {formatCost(preview.amount, locale)} {currencyCode.trim().toUpperCase() || "TND"} / {preview.baseUnitSymbol ?? "?"}
            </span>
          </p>
        )}
        {!preview && purchaseUnitId && baseUnitId && (
          <p className="text-xs text-[var(--color-muted-foreground)]">{t("multipleUnits")}</p>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] p-3">
            <div>
              <p className="text-sm font-medium">{t("fields.isPreferred")}</p>
            </div>
            <Switch checked={isPreferred} onCheckedChange={(checked) => setIsPreferred(checked)} />
          </div>
          {dialog.mode === "edit" && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--color-border)] p-3">
              <div>
                <p className="text-sm font-medium">{t("columns.active")}</p>
              </div>
              <Switch checked={isActive} onCheckedChange={(checked) => setIsActive(checked)} />
            </div>
          )}
        </div>

        <Field label={t("fields.notes")} htmlFor="ing-item-notes">
          <Textarea id="ing-item-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}