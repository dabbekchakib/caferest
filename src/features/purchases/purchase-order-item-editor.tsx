"use client";

import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/purchases/format";
import { calculateLineTotals, calculateOrderTotals } from "@/lib/purchases/calculations";
import type {
  LineDiscountType,
  PurchaseOrderLineInput,
  PurchaseOrderItem,
} from "@/lib/purchases/types";
import { purchaseOrderLineInputSchema } from "@/validations/purchases";
import { getPurchaseCatalogAction } from "@/features/purchases/actions";

export interface PurchaseOrderSupplierOption {
  id: string;
  name: string;
  code: string | null;
}

export interface PurchaseOrderTaxOption {
  id: string;
  name: string;
  rate: number;
}

export interface PurchaseOrderUnitOption {
  id: string;
  symbol: string | null;
}

export interface PurchaseOrderItemDraft {
  key: string;
  ingredientSupplierId: string;
  ingredientId: string;
  ingredientName: string;
  supplierSku: string;
  purchaseUnitId: string | null;
  purchaseUnitSymbol: string | null;
  quantity: number;
  unitPrice: number;
  discountType: LineDiscountType;
  discountValue: number;
  taxId: string | null;
  taxRate: number;
  description: string;
  notes: string;
}

export interface PurchaseOrderItemsHandle {
  supplierId: string | null;
  supplierName: string | null;
  shippingAmount: number;
  otherCharges: number;
  lines: PurchaseOrderItemDraft[];
}

export interface PurchaseOrderItemEditorProps {
  suppliers: PurchaseOrderSupplierOption[];
  taxes: PurchaseOrderTaxOption[];
  units: PurchaseOrderUnitOption[];
  defaultCurrency: string;
  initialSupplierId?: string | null;
  initialItems?: PurchaseOrderItem[];
}

interface CatalogOption {
  ingredientSupplierId: string;
  ingredientId: string;
  ingredientName: string;
  supplierSku: string | null;
  purchaseUnitId: string | null;
  purchaseUnitSymbol: string | null;
  purchasePrice: number;
}

let draftKey = 0;
function nextKey(): string {
  draftKey += 1;
  return `line-${draftKey}`;
}

export const PurchaseOrderItemEditor = forwardRef<
  PurchaseOrderItemsHandle,
  PurchaseOrderItemEditorProps
>(function PurchaseOrderItemEditor(
  { suppliers, taxes, units, defaultCurrency, initialSupplierId, initialItems },
  ref
) {
  const tf = useTranslations("purchaseOrderForm");
  const ti = useTranslations("purchaseOrderItems");
  const tt = useTranslations("purchaseOrderTotals");

  const unitSymbols = useMemo(() => {
    const map = new Map<string, string>();
    for (const unit of units) {
      if (unit.symbol) map.set(unit.id, unit.symbol);
    }
    return map;
  }, [units]);

  const [supplierId, setSupplierId] = useState<string>(
    initialSupplierId ?? ""
  );
  const supplierName = useMemo(
    () => suppliers.find((s) => s.id === supplierId)?.name ?? null,
    [suppliers, supplierId]
  );
  const [catalog, setCatalog] = useState<CatalogOption[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [offerId, setOfferId] = useState("");
  const [lines, setLines] = useState<PurchaseOrderItemDraft[]>(() =>
    (initialItems ?? []).map((item) => ({
      key: nextKey(),
      ingredientSupplierId: item.ingredient_supplier_id ?? "",
      ingredientId: item.ingredient_id ?? "",
      ingredientName: "",
      supplierSku: item.supplier_sku ?? "",
      purchaseUnitId: item.purchase_unit_id,
      purchaseUnitSymbol: item.purchase_unit_id
        ? unitSymbols.get(item.purchase_unit_id) ?? null
        : null,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discountType: (item.discount_type ?? "none") as LineDiscountType,
      discountValue: item.discount_value ?? 0,
      taxId: item.tax_id,
      taxRate: item.tax_rate ?? 0,
      description: item.description ?? "",
      notes: item.notes ?? "",
    }))
  );
  const [shippingAmount, setShippingAmount] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);

  function loadCatalog(supplier: string) {
    setSupplierId(supplier);
    setLines([]);
    setOfferId("");
    setCatalog([]);
    if (!supplier) return;
    setCatalogLoading(true);
    void getPurchaseCatalogAction({ supplierId: supplier })
      .then((items) => {
        const mapped = items.map((item) => ({ ...item }));
        setCatalog(mapped);
        setOfferId(mapped[0]?.ingredientSupplierId ?? "");
      })
      .catch(() => setCatalog([]))
      .finally(() => setCatalogLoading(false));
  }

  function pickOffer() {
    const offer = catalog.find((c) => c.ingredientSupplierId === offerId);
    if (!offer) return;
    if (lines.some((l) => l.ingredientSupplierId === offer.ingredientSupplierId)) {
      setOfferId("");
      return;
    }
    const defaultTax = taxes[0];
    setLines((prev) => [
      ...prev,
      {
        key: nextKey(),
        ingredientSupplierId: offer.ingredientSupplierId,
        ingredientId: offer.ingredientId,
        ingredientName: offer.ingredientName,
        supplierSku: offer.supplierSku ?? "",
        purchaseUnitId: offer.purchaseUnitId,
        purchaseUnitSymbol: offer.purchaseUnitSymbol,
        quantity: 1,
        unitPrice: offer.purchasePrice,
        discountType: "none",
        discountValue: 0,
        taxId: defaultTax?.id ?? null,
        taxRate: defaultTax?.rate ?? 0,
        description: offer.ingredientName,
        notes: "",
      },
    ]);
    setOfferId("");
  }

  function updateLine(key: string, patch: Partial<PurchaseOrderItemDraft>) {
    setLines((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line))
    );
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key));
  }

  const summary = useMemo(() => {
    const linesTotals = lines.map((line) =>
      calculateLineTotals({
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountType: line.discountType,
        discountValue: line.discountValue,
        taxRate: line.taxRate,
      })
    );
    return calculateOrderTotals(linesTotals, shippingAmount, otherCharges);
  }, [lines, shippingAmount, otherCharges]);

  useImperativeHandle(ref, () => ({
    supplierId: supplierId || null,
    supplierName,
    shippingAmount,
    otherCharges,
    lines,
  }));

  const availableOffers = useMemo(
    () =>
      catalog.filter(
        (c) => !lines.some((l) => l.ingredientSupplierId === c.ingredientSupplierId)
      ),
    [catalog, lines]
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={tf("supplier")} htmlFor="po-supplier" required>
          <Select
            id="po-supplier"
            value={supplierId}
            onChange={(e) => loadCatalog(e.target.value)}
          >
            <option value="">{tf("selectSupplier")}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.code ? ` (${s.code})` : ""}
              </option>
            ))}
          </Select>
        </Field>

        {supplierId && (
          <Field label={tf("selectOffer")} htmlFor="po-offer">
            <div className="flex items-center gap-2">
              <Select
                id="po-offer"
                value={offerId}
                onChange={(e) => setOfferId(e.target.value)}
                disabled={!supplierId || catalogLoading || availableOffers.length === 0}
              >
                {availableOffers.map((o) => (
                  <option key={o.ingredientSupplierId} value={o.ingredientSupplierId}>
                    {o.ingredientName}
                    {o.supplierSku ? ` · ${o.supplierSku}` : ""}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!offerId}
                onClick={pickOffer}
              >
                <Plus className="size-4" aria-hidden /> {tf("addItem")}
              </Button>
            </div>
            {catalog.length > 0 && availableOffers.length === 0 && (
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {ti("noItems")}
              </p>
            )}
          </Field>
        )}
      </div>

      {lines.length > 0 && (
        <div className="space-y-3">
          {lines.map((line) => {
            const totals = calculateLineTotals({
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              discountType: line.discountType,
              discountValue: line.discountValue,
              taxRate: line.taxRate,
            });
            return (
              <div
                key={line.key}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {line.ingredientName}
                    </p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {[line.supplierSku, line.purchaseUnitSymbol]
                        .filter(Boolean)
                        .join(" · ") || "\u00a0"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-muted)] hover:text-[var(--color-danger)]"
                    aria-label={tf("removeItem")}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-6">
                  <Field label={ti("quantity")}>
                    <Input
                      type="number"
                      min={0.001}
                      step="any"
                      value={Number.isFinite(line.quantity) ? line.quantity : ""}
                      onChange={(e) =>
                        updateLine(line.key, {
                          quantity: Number.parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </Field>
                  <Field label={ti("unitPrice")}>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={Number.isFinite(line.unitPrice) ? line.unitPrice : ""}
                      onChange={(e) =>
                        updateLine(line.key, {
                          unitPrice: Number.parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </Field>
                  <Field label={ti("taxRate")}>
                    <Select
                      value={line.taxId ?? ""}
                      onChange={(e) => {
                        const rate = Number.parseFloat(e.target.selectedOptions[0].dataset.rate ?? "0");
                        updateLine(line.key, {
                          taxId: e.target.value || null,
                          taxRate: Number.isFinite(rate) ? rate : 0,
                        });
                      }}
                    >
                      <option value="">0</option>
                      {taxes.map((tax) => (
                        <option key={tax.id} value={tax.id} data-rate={String(tax.rate)}>
                          {tax.name} ({tax.rate}%)
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={ti("discount")}>
                    <div className="flex gap-1.5">
                      <Select
                        className="w-24"
                        value={line.discountType}
                        onChange={(e) =>
                          updateLine(line.key, {
                            discountType: e.target.value as LineDiscountType,
                            discountValue:
                              e.target.value === "none" ? 0 : line.discountValue,
                          })
                        }
                      >
                        <option value="none">{tf("discountNone")}</option>
                        <option value="percentage">{tf("discountPercent")}</option>
                        <option value="fixed">{tf("discountFixed")}</option>
                      </Select>
                      <Input
                        type="number"
                        min={0}
                        step="any"
                        disabled={line.discountType === "none"}
                        value={line.discountValue || ""}
                        onChange={(e) =>
                          updateLine(line.key, {
                            discountValue: Number.parseFloat(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </Field>
                  <Field label={ti("subtotal")}>
                    <p className="flex h-11 items-center text-sm font-medium">
                      {formatMoney(totals.subtotal, defaultCurrency)}
                    </p>
                  </Field>
                  <Field label={ti("total")}>
                    <p className="flex h-11 items-center text-sm font-semibold">
                      {formatMoney(totals.total, defaultCurrency)}
                    </p>
                  </Field>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <Field label={ti("notes")}>
                    <Input
                      value={line.notes}
                      onChange={(e) => updateLine(line.key, { notes: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={tf("shippingAmount")}>
            <Input
              type="number"
              min={0}
              step="any"
              value={shippingAmount || ""}
              onChange={(e) =>
                setShippingAmount(Number.parseFloat(e.target.value) || 0)
              }
            />
          </Field>
          <Field label={tf("otherCharges")}>
            <Input
              type="number"
              min={0}
              step="any"
              value={otherCharges || ""}
              onChange={(e) =>
                setOtherCharges(Number.parseFloat(e.target.value) || 0)
              }
            />
          </Field>
        </div>

        <div className="flex min-w-52 flex-col gap-1.5 text-sm">
          <p className="flex justify-between">
            <span className="text-[var(--color-muted-foreground)]">
              {tt("subtotal")}
            </span>
            <span className="font-medium">
              {formatMoney(summary.subtotal, defaultCurrency)}
            </span>
          </p>
          {summary.discountAmount > 0 && (
            <p className="flex justify-between">
              <span className="text-[var(--color-muted-foreground)]">
                {tt("discount")}
              </span>
              <span className="font-medium text-[var(--color-danger)]">
                -{formatMoney(summary.discountAmount, defaultCurrency)}
              </span>
            </p>
          )}
          <p className="flex justify-between">
            <span className="text-[var(--color-muted-foreground)]">
              {tt("tax")}
            </span>
            <span className="font-medium">
              {formatMoney(summary.taxAmount, defaultCurrency)}
            </span>
          </p>
          <p className="mt-1 flex justify-between border-t border-[var(--color-border)] pt-1.5 text-base font-semibold">
            <span>{tt("grandTotal")}</span>
            <span>{formatMoney(summary.total, defaultCurrency)}</span>
          </p>
        </div>
      </div>
    </div>
  );
});

function toLineInput(
  line: PurchaseOrderItemDraft,
  index: number
): PurchaseOrderLineInput {
  return {
    ingredientId: line.ingredientId,
    ingredientSupplierId: line.ingredientSupplierId,
    description: line.description || null,
    supplierSku: line.supplierSku || null,
    quantity: line.quantity,
    purchaseUnitId: line.purchaseUnitId,
    unitPrice: line.unitPrice,
    discountType: line.discountType,
    discountValue: line.discountValue,
    taxId: line.taxId,
    taxRate: line.taxRate,
    notes: line.notes || null,
    sortOrder: index,
  };
}

export function toPurchaseOrderLineInputs(
  lines: PurchaseOrderItemDraft[]
): PurchaseOrderLineInput[] {
  return lines.map(toLineInput);
}

/** Client validation for the line collection (mirrors the server schema). */
export const purchaseOrderItemValidator = purchaseOrderLineInputSchema;