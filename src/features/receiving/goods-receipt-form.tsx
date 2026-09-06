"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/stores/use-toast-store";
import { formatDate, parseQuantity } from "@/lib/purchases/format";
import type { GoodsReceiptWithRelations } from "@/lib/receiving/types";
import type { ReceivablePurchaseOrder } from "@/lib/receiving/types";
import {
  getReceivableOrdersAction,
  getInventoryLocationsAction,
  createGoodsReceiptAction,
  updateGoodsReceiptAction,
  submitGoodsReceiptAction,
  nextReceiptNumberPreviewAction,
  type InventoryLocationLite,
} from "@/features/receiving/actions";

export interface GoodsReceiptLineDraft {
  key: string;
  purchaseOrderItemId: string;
  ingredientId: string;
  ingredientName: string;
  description: string | null;
  supplierSku: string | null;
  unitSymbol: string | null;
  sortOrder: number;
  remaining: number;
  received: number;
  accepted: number;
  rejected: number;
  lot: string;
  batch: string;
  expiry: string;
  notes: string;
  dirty?: boolean;
}

export interface GoodsReceiptFormProps {
  mode: "create" | "edit";
  receipt: GoodsReceiptWithRelations | null;
  initialPurchaseOrderId?: string | null;
}

function toDateInput(value?: string | Date | null): string {
  if (!value) return "";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function draftLinesFromReceipt(receipt: GoodsReceiptWithRelations): GoodsReceiptLineDraft[] {
  return receipt.items.map((item) => ({
    key: item.id,
    purchaseOrderItemId: item.purchase_order_item_id,
    ingredientId: item.ingredient_id,
    ingredientName: item.ingredientName ?? item.ingredient_id,
    description: item.description,
    supplierSku: item.supplier_sku,
    unitSymbol: item.purchaseUnitSymbol,
    sortOrder: item.sort_order,
    remaining: Math.max(
      0,
      item.ordered_quantity - item.previously_received_quantity
    ),
    received: item.received_quantity,
    accepted: item.accepted_quantity,
    rejected: item.rejected_quantity,
    lot: item.lot_number ?? "",
    batch: item.batch_number ?? "",
    expiry: item.expiry_date ?? "",
    notes: item.notes ?? "",
  }));
}

export function GoodsReceiptForm({
  mode,
  receipt,
  initialPurchaseOrderId,
}: GoodsReceiptFormProps) {
  const tf = useTranslations("receiptForm");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tActions = useTranslations("receiptActions");
  const tRoot = useTranslations();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<ReceivablePurchaseOrder[]>([]);
  const [locations, setLocations] = useState<InventoryLocationLite[]>([]);
  const [numberPreview, setNumberPreview] = useState<string | null>(null);

  const [purchaseOrderId, setPurchaseOrderId] = useState(
    mode === "edit" ? (receipt?.purchase_order_id ?? "") : (initialPurchaseOrderId ?? "")
  );
  const [receiptDate, setReceiptDate] = useState(
    mode === "edit"
      ? toDateInput(receipt?.receipt_date)
      : new Date().toISOString().slice(0, 10)
  );
  const [locationId, setLocationId] = useState(
    mode === "edit" ? (receipt?.inventory_location_id ?? "") : ""
  );
  const [deliveryNote, setDeliveryNote] = useState(
    receipt?.delivery_note_number ?? ""
  );
  const [supplierInvoice, setSupplierInvoice] = useState(
    receipt?.supplier_invoice_number ?? ""
  );
  const [notes, setNotes] = useState(receipt?.notes ?? "");
  const [internalNotes, setInternalNotes] = useState(
    receipt?.internal_notes ?? ""
  );

  const [lines, setLines] = useState<GoodsReceiptLineDraft[]>(
    () => (mode === "edit" && receipt ? draftLinesFromReceipt(receipt) : [])
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [orderData, locationData, numberData] = await Promise.all([
          getReceivableOrdersAction(),
          getInventoryLocationsAction(),
          mode === "create"
            ? nextReceiptNumberPreviewAction()
            : Promise.resolve(""),
        ]);
        if (cancelled) return;
        setOrders(orderData);
        setLocations(locationData);
        setNumberPreview(numberData || null);
        if (mode === "create") {
          if (locationData.length > 0) setLocationId(locationData[0].id);
          if (!purchaseOrderId && orderData.length > 0) {
            const first = orderData[0];
            setPurchaseOrderId(first.id);
            buildLinesFromOrder(first);
          } else if (purchaseOrderId) {
            const target = orderData.find((order) => order.id === purchaseOrderId);
            if (target) buildLinesFromOrder(target);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function buildLinesFromOrder(order: ReceivablePurchaseOrder) {
    setLines(
      order.lines.map((line) => ({
        key: line.id,
        purchaseOrderItemId: line.id,
        ingredientId: line.ingredientId ?? "",
        ingredientName: line.ingredientName ?? line.description ?? line.id,
        description: line.description,
        supplierSku: line.supplierSku,
        unitSymbol: line.purchaseUnitSymbol,
        sortOrder: line.sortOrder,
        remaining: line.remainingQuantity,
        received: line.remainingQuantity,
        accepted: line.remainingQuantity,
        rejected: 0,
        lot: "",
        batch: "",
        expiry: "",
        notes: "",
        dirty: false,
      }))
    );
  }

  function onOrderChange(nextId: string) {
    setPurchaseOrderId(nextId);
    const target = orders.find((order) => order.id === nextId);
    if (target) buildLinesFromOrder(target);
  }

  function updateLine(key: string, patch: Partial<GoodsReceiptLineDraft>) {
    setLines((prev) =>
      prev.map((line) =>
        line.key === key ? { ...line, ...patch, dirty: true } : line
      )
    );
  }

  async function handleSubmit(saveMode: "save" | "saveAndSubmit") {
    const nextErrors: Record<string, string> = {};
    if (!purchaseOrderId) nextErrors.purchaseOrderId = tRoot("validation.invalidValue");
    if (!receiptDate) nextErrors.receiptDate = tRoot("validation.invalidValue");
    if (!locationId) nextErrors.locationId = tRoot("validation.invalidValue");
    if (lines.length === 0) nextErrors.lines = tf("noItems");

    for (const line of lines) {
      if (line.received <= 0) {
        nextErrors[`received.${line.key}`] = tRoot("validation.invalidValue");
      }
      if (line.accepted + line.rejected > line.received) {
        nextErrors[`split.${line.key}`] = tf("splitInvalid");
      }
      if (line.received > line.remaining) {
        nextErrors[`received.${line.key}`] = tf("overdelivery");
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setBusy(true);
    const items = lines.map((line) => ({
      purchaseOrderItemId: line.purchaseOrderItemId,
      ingredientId: line.ingredientId,
      receivedQuantity: line.received,
      acceptedQuantity: line.accepted,
      rejectedQuantity: line.rejected,
      lotNumber: line.lot.trim() || null,
      batchNumber: line.batch.trim() || null,
      expiryDate: line.expiry || null,
      notes: line.notes.trim() || null,
      sortOrder: line.sortOrder,
    }));

    const result =
      mode === "create"
        ? await createGoodsReceiptAction({
            purchaseOrderId,
            receiptDate: receiptDate ? new Date(`${receiptDate}T00:00:00`) : null,
            inventoryLocationId: locationId || null,
            deliveryNoteNumber: deliveryNote,
            supplierInvoiceNumber: supplierInvoice,
            notes,
            internalNotes,
            items,
          })
        : receipt
          ? await updateGoodsReceiptAction({
              receiptId: receipt.id,
              purchaseOrderId,
              receiptDate: receiptDate ? new Date(`${receiptDate}T00:00:00`) : null,
              inventoryLocationId: locationId || null,
              deliveryNoteNumber: deliveryNote,
              supplierInvoiceNumber: supplierInvoice,
              notes,
              internalNotes,
              items,
            })
          : null;

    if (!result || !result.ok) {
      setBusy(false);
      setErrors({});
      toast.error({
        title: tc("common.error"),
        description: tRoot(result?.key ?? "authorization.errors.generic"),
      });
      return;
    }

    const receiptId = result.data?.id ?? receipt?.id ?? "";
    if (saveMode === "saveAndSubmit" && mode === "create") {
      const submitResult = await submitGoodsReceiptAction({ receiptId });
      setBusy(false);
      if (!submitResult.ok) {
        toast.error({
          title: tc("common.error"),
          description: tRoot(submitResult.key ?? "authorization.errors.generic"),
        });
        router.push(`/receipts/${receiptId}`);
        router.refresh();
        return;
      }
      toast.success({ title: tActions("submitted") });
    } else {
      setBusy(false);
      toast.success({ title: tf("save") });
    }

    router.push(`/receipts/${receiptId}`);
    router.refresh();
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={mode === "create" ? tf("titleNew") : (receipt?.receipt_number ?? tf("titleEdit"))}
        breadcrumbs={[
          { label: tn("supply") },
          { label: tn("receiving"), href: "/receipts" },
          {
            label:
              mode === "create"
                ? tf("breadcrumbNew")
                : (receipt?.receipt_number ?? tf("breadcrumbEdit")),
          },
        ]}
        actions={
          <Link href={mode === "create" ? "/receipts" : `/receipts/${receipt?.id ?? ""}`}>
            <Button variant="outline">{tf("cancel")}</Button>
          </Link>
        }
      />

      <div className="space-y-6">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-4 text-sm font-semibold">{tf("itemsLabel")}</h2>

          {mode === "create" && (
            <div className="mb-4 grid gap-4 sm:grid-cols-2">
              <Field
                label={tf("purchaseOrder")}
                htmlFor="receipt-po"
                required
                error={errors.purchaseOrderId}
              >
                <Select
                  id="receipt-po"
                  value={purchaseOrderId}
                  onChange={(e) => onOrderChange(e.target.value)}
                  disabled={loading}
                >
                  <option value="">{tf("purchaseOrderPlaceholder")}</option>
                  {orders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNumber} — {order.supplierName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label={tf("receiptDate")}
                htmlFor="receipt-date"
                required
                error={errors.receiptDate}
              >
                <Input
                  id="receipt-date"
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                />
              </Field>
            </div>
          )}

          {mode === "edit" && (
            <div className="mb-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <p className="text-[var(--color-muted-foreground)]">
                {tf("purchaseOrder")}:{" "}
                <span className="font-medium text-[var(--color-foreground)]">
                  {receipt?.purchaseOrderNumber ?? "—"}
                </span>
              </p>
              <p className="text-[var(--color-muted-foreground)]">
                {tf("receiptDate")}:{" "}
                <span className="font-medium text-[var(--color-foreground)]">
                  {formatDate(receipt?.receipt_date)}
                </span>
              </p>
              <p className="text-[var(--color-muted-foreground)]">
                {tn("receiving")}:{" "}
                <span className="font-medium text-[var(--color-foreground)]">
                  {receipt?.receipt_number ?? "—"}
                </span>
              </p>
            </div>
          )}

          {mode === "create" && numberPreview && (
            <p className="mb-4 text-xs text-[var(--color-muted-foreground)]">
              {numberPreview}
            </p>
          )}

          {/* Location */}
          <div className="mb-4 grid gap-4 sm:grid-cols-2">
            <Field
              label={tf("location")}
              htmlFor="receipt-location"
              required
              error={errors.locationId}
            >
              <Select
                id="receipt-location"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">{tf("locationPlaceholder")}</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name}
                    {location.code ? ` (${location.code})` : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tf("deliveryNote")} htmlFor="receipt-delivery">
              <Input
                id="receipt-delivery"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
              />
            </Field>
            <Field label={tf("supplierInvoice")} htmlFor="receipt-invoice">
              <Input
                id="receipt-invoice"
                value={supplierInvoice}
                onChange={(e) => setSupplierInvoice(e.target.value)}
              />
            </Field>
            <Field label={tf("internalNotes")} htmlFor="receipt-internal">
              <Textarea
                id="receipt-internal"
                rows={2}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />
            </Field>
            <Field label={tf("notes")} htmlFor="receipt-notes" className="sm:col-span-2">
              <Textarea
                id="receipt-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-4 text-sm font-semibold">{tf("itemsLabel")}</h2>
          {errors.lines && (
            <p role="alert" className="mb-3 text-xs text-[var(--color-danger)]">
              {errors.lines}
            </p>
          )}
          {lines.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--color-muted-foreground)]">
              {tf("noItems")}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="hidden gap-3 text-xs uppercase tracking-wide text-[var(--color-muted-foreground)] lg:grid lg:grid-cols-[minmax(0,2fr)_repeat(4,84px)_repeat(3,130px)_minmax(0,1fr)_32px]">
                <span>{tf("lineColumns.ingredient")}</span>
                <span>{tf("lineColumns.remaining")}</span>
                <span>{tf("lineColumns.received")}</span>
                <span>{tf("lineColumns.accepted")}</span>
                <span>{tf("lineColumns.rejected")}</span>
                <span>{tf("lineColumns.lot")}</span>
                <span>{tf("lineColumns.batch")}</span>
                <span>{tf("lineColumns.expiry")}</span>
                <span>{tf("lineColumns.notes")}</span>
                <span />
              </div>
              {lines.map((line) => (
                <div
                  key={line.key}
                  className="rounded-xl border border-[var(--color-border)] p-3 lg:grid lg:grid-cols-[minmax(0,2fr)_repeat(4,84px)_repeat(3,130px)_minmax(0,1fr)_32px] lg:items-center lg:gap-3"
                >
                  <div className="mb-2 lg:mb-0 lg:min-w-0">
                    <p className="truncate text-sm font-medium">
                      {line.ingredientName}
                    </p>
                    <p className="truncate text-xs text-[var(--color-muted-foreground)]">
                      {line.supplierSku ?? line.description ?? ""}
                      {line.unitSymbol ? ` · ${line.unitSymbol}` : ""}
                    </p>
                  </div>
                  <div className="mb-2 text-sm text-[var(--color-muted-foreground)] lg:mb-0">
                    {line.remaining}
                  </div>
                  <Field
                    label={`${tf("lineColumns.received")}${line.unitSymbol ? ` (${line.unitSymbol})` : ""}`}
                    htmlFor={`receipt-received-${line.key}`}
                    className="lg:hidden"
                    error={errors[`received.${line.key}`]}
                  >
                    <Input
                      id={`receipt-received-${line.key}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={line.received}
                      onChange={(e) =>
                        updateLine(line.key, {
                          received: parseQuantity(e.target.value),
                          accepted: Math.min(
                            parseQuantity(e.target.value),
                            line.accepted
                          ),
                        })
                      }
                    />
                  </Field>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    aria-label={tf("lineColumns.received")}
                    className="w-20 lg:w-full"
                    value={line.received}
                    onChange={(e) =>
                      updateLine(line.key, {
                        received: parseQuantity(e.target.value),
                        accepted: Math.min(
                          parseQuantity(e.target.value),
                          line.accepted
                        ),
                      })
                    }
                  />
                  <Field
                    label={tf("lineColumns.accepted")}
                    htmlFor={`receipt-accepted-${line.key}`}
                    className="lg:hidden"
                    error={errors[`split.${line.key}`]}
                  >
                    <Input
                      id={`receipt-accepted-${line.key}`}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={line.accepted}
                      onChange={(e) =>
                        updateLine(line.key, {
                          accepted: parseQuantity(e.target.value),
                          rejected: Math.max(
                            0,
                            line.rejected +
                              (line.accepted - parseQuantity(e.target.value))
                          ),
                        })
                      }
                    />
                  </Field>
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    aria-label={tf("lineColumns.accepted")}
                    className="w-20 lg:w-full"
                    value={line.accepted}
                    onChange={(e) =>
                      updateLine(line.key, {
                        accepted: parseQuantity(e.target.value),
                        rejected: Math.max(
                          0,
                          line.rejected +
                            (line.accepted - parseQuantity(e.target.value))
                        ),
                      })
                    }
                  />
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    aria-label={tf("lineColumns.rejected")}
                    className="w-20 lg:w-full"
                    value={line.rejected}
                    onChange={(e) =>
                      updateLine(line.key, {
                        rejected: parseQuantity(e.target.value),
                      })
                    }
                  />
                  <Input
                    type="text"
                    aria-label={tf("lineColumns.lot")}
                    className="w-28 lg:w-full"
                    value={line.lot}
                    onChange={(e) => updateLine(line.key, { lot: e.target.value })}
                  />
                  <Input
                    type="text"
                    aria-label={tf("lineColumns.batch")}
                    className="w-28 lg:w-full"
                    value={line.batch}
                    onChange={(e) => updateLine(line.key, { batch: e.target.value })}
                  />
                  <Input
                    type="date"
                    aria-label={tf("lineColumns.expiry")}
                    className="w-32 lg:w-full"
                    value={line.expiry}
                    onChange={(e) => updateLine(line.key, { expiry: e.target.value })}
                  />
                  <Input
                    type="text"
                    aria-label={tf("lineColumns.notes")}
                    className="w-28 lg:w-full"
                    value={line.notes}
                    onChange={(e) => updateLine(line.key, { notes: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                    className="lg:ml-1"
                    aria-label={tc("common.remove")}
                  >
                    <X className="size-4 text-[var(--color-muted-foreground)]" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {lines.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                const last = lines[lines.length - 1];
                const tpl = lines.length > 0 ? last : null;
                const nextOrder = orders.find((o) => o.id === purchaseOrderId);
                const nextLine = nextOrder?.lines.find(
                  (line) => !lines.some((l) => l.purchaseOrderItemId === line.id)
                );
                const line = nextLine
                  ? {
                      key: nextLine.id,
                      purchaseOrderItemId: nextLine.id,
                      ingredientId: nextLine.ingredientId ?? "",
                      ingredientName:
                        nextLine.ingredientName ??
                        nextLine.description ??
                        nextLine.id,
                      description: nextLine.description,
                      supplierSku: nextLine.supplierSku,
                      unitSymbol: nextLine.purchaseUnitSymbol,
                      sortOrder: nextLine.sortOrder,
                      remaining: nextLine.remainingQuantity,
                      received: nextLine.remainingQuantity,
                      accepted: nextLine.remainingQuantity,
                      rejected: 0,
                      lot: "",
                      batch: "",
                      expiry: "",
                      notes: "",
                    }
                  : tpl
                    ? {
                        ...tpl,
                        key: `${tpl.key}-copy`,
                        received: tpl.received,
                        accepted: tpl.accepted,
                        rejected: tpl.rejected,
                      }
                    : null;
                if (line) setLines((prev) => [...prev, line]);
              }}
            >
              <Plus className="size-4" aria-hidden /> {tf("addLine")}
            </Button>
          )}
        </section>

        <div className="flex items-center justify-end gap-2">
          <Link href={mode === "create" ? "/receipts" : `/receipts/${receipt?.id ?? ""}`}>
            <Button variant="outline">{tf("cancel")}</Button>
          </Link>
          {mode === "create" ? (
            <>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void handleSubmit("save")}
              >
                {tf("save")}
              </Button>
              <Button loading={busy} onClick={() => void handleSubmit("saveAndSubmit")}>
                {busy ? tf("saving") : tf("saveAndSubmit")}
              </Button>
            </>
          ) : (
            <Button loading={busy} onClick={() => void handleSubmit("save")}>
              {busy ? tf("saving") : tf("save")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}