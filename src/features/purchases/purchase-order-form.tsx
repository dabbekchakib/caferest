"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/shared/page-header";
import { Field } from "@/components/shared/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/stores/use-toast-store";
import {
  PurchaseOrderItemEditor,
  toPurchaseOrderLineInputs,
  type PurchaseOrderItemsHandle,
  type PurchaseOrderSupplierOption,
  type PurchaseOrderTaxOption,
  type PurchaseOrderUnitOption,
} from "@/features/purchases/purchase-order-item-editor";
import {
  createPurchaseOrderAction,
  updatePurchaseOrderAction,
} from "@/features/purchases/actions";
import { purchaseOrderItemValidator } from "@/features/purchases/purchase-order-item-editor";
import type { PurchaseOrderWithRelations } from "@/lib/purchases/types";

export interface PurchaseOrderFormProps {
  mode: "create" | "edit";
  suppliers: PurchaseOrderSupplierOption[];
  taxes: PurchaseOrderTaxOption[];
  units: PurchaseOrderUnitOption[];
  defaultCurrency: string;
  order?: PurchaseOrderWithRelations | null;
}

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function PurchaseOrderForm({
  mode,
  suppliers,
  taxes,
  units,
  defaultCurrency,
  order,
}: PurchaseOrderFormProps) {
  const tf = useTranslations("purchaseOrderForm");
  const tList = useTranslations("purchaseOrders");
  const tn = useTranslations("navigation");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const router = useRouter();
  const toast = useToast();

  const editorRef = useRef<PurchaseOrderItemsHandle>(null);

  const [orderDate, setOrderDate] = useState(toDateInput(order?.order_date));
  const [expectedDate, setExpectedDate] = useState(
    toDateInput(order?.expected_delivery_date)
  );
  const [currencyCode, setCurrencyCode] = useState(
    order?.currency_code ?? defaultCurrency
  );
  const [notes, setNotes] = useState(order?.notes ?? "");
  const [internalNotes, setInternalNotes] = useState(
    order?.internal_notes ?? ""
  );
  const [supplierNotes, setSupplierNotes] = useState(
    order?.supplier_notes ?? ""
  );
  const [shippingAddress, setShippingAddress] = useState(
    order?.shipping_address ?? ""
  );
  const [billingAddress, setBillingAddress] = useState(
    order?.billing_address ?? ""
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const clean = (value: string) => (value.trim() === "" ? null : value.trim());

  async function handleSubmit() {
    const handle = editorRef.current;
    if (!handle) return;

    const nextErrors: Record<string, string> = {};
    const finalSupplierId = handle.supplierId ?? "";
    if (!finalSupplierId) nextErrors.supplierId = tRoot("validation.invalidValue");
    if (!orderDate) nextErrors.orderDate = tRoot("validation.invalidValue");

    const items = toPurchaseOrderLineInputs(handle.lines);
    const lineResult = purchaseOrderItemValidator.safeParse(items);
    if (!finalSupplierId || !orderDate || !lineResult.success) {
      const firstIssue = lineResult.success
        ? null
        : lineResult.error.issues[0];
      if (firstIssue) {
        nextErrors.items = tRoot(firstIssue.message);
      }
      setErrors(nextErrors);
      return;
    }

    setBusy(true);
    const result =
      mode === "create"
        ? await createPurchaseOrderAction({
            supplierId: finalSupplierId,
            orderDate: new Date(`${orderDate}T00:00:00`),
            expectedDeliveryDate: expectedDate
              ? new Date(`${expectedDate}T00:00:00`)
              : null,
            currencyCode,
            shippingAmount: handle.shippingAmount,
            otherCharges: handle.otherCharges,
            notes: clean(notes),
            internalNotes: clean(internalNotes),
            supplierNotes: clean(supplierNotes),
            shippingAddress: clean(shippingAddress),
            billingAddress: clean(billingAddress),
            items: lineResult.data as typeof items,
          })
        : order
          ? await updatePurchaseOrderAction({
              orderId: order.id,
              supplierId: finalSupplierId,
              orderDate: new Date(`${orderDate}T00:00:00`),
              expectedDeliveryDate: expectedDate
                ? new Date(`${expectedDate}T00:00:00`)
                : null,
              currencyCode,
              shippingAmount: handle.shippingAmount,
              otherCharges: handle.otherCharges,
              notes: clean(notes),
              internalNotes: clean(internalNotes),
              supplierNotes: clean(supplierNotes),
              shippingAddress: clean(shippingAddress),
              billingAddress: clean(billingAddress),
              items: lineResult.data as typeof items,
            })
          : null;
    setBusy(false);

    if (result?.ok) {
      toast.success({ title: tf("save") });
      router.push(`/purchase-orders/${result.data?.id ?? order?.id}`);
      router.refresh();
    } else if (result) {
      setErrors({});
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={mode === "create" ? tList("title") : (order?.order_number ?? tList("title"))}
        breadcrumbs={[
          { label: tn("supply") },
          { label: tn("purchaseOrders"), href: "/purchase-orders" },
          { label: mode === "create" ? tList("newOrder") : (order?.order_number ?? "") },
        ]}
        actions={
          <Link href="/purchase-orders">
            <Button variant="outline">{tf("cancel")}</Button>
          </Link>
        }
      />

      <div className="space-y-6">
        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-4 text-sm font-semibold">{tf("generalTabTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label={tf("orderDate")}
              htmlFor="po-form-date"
              required
              error={errors.orderDate}
            >
              <Input
                id="po-form-date"
                type="date"
                value={orderDate}
                onChange={(e) => {
                  setOrderDate(e.target.value);
                  setErrors((prev) => ({ ...prev, orderDate: undefined as unknown as string }));
                }}
              />
            </Field>
            <Field label={tf("expectedDate")} htmlFor="po-form-expected">
              <Input
                id="po-form-expected"
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </Field>
            <Field label={tf("currency")} htmlFor="po-form-currency">
              <Select
                id="po-form-currency"
                value={currencyCode}
                onChange={(e) => setCurrencyCode(e.target.value)}
              >
                <option value={defaultCurrency}>{defaultCurrency}</option>
              </Select>
            </Field>
            <Field label={tf("internalNotes")} htmlFor="po-form-internal" className="lg:col-span-2">
              <Textarea
                id="po-form-internal"
                rows={2}
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
              />
            </Field>
            <Field label={tf("shippingAddress")} htmlFor="po-form-ship" className="lg:col-span-2">
              <Textarea
                id="po-form-ship"
                rows={2}
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
              />
            </Field>
            <Field label={tf("billingAddress")} htmlFor="po-form-billing">
              <Textarea
                id="po-form-billing"
                rows={2}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
              />
            </Field>
            <Field label={tf("supplierNotes")} htmlFor="po-form-supplier-notes">
              <Textarea
                id="po-form-supplier-notes"
                rows={2}
                value={supplierNotes}
                onChange={(e) => setSupplierNotes(e.target.value)}
              />
            </Field>
            <Field label={tf("notes")} htmlFor="po-form-notes" className="lg:col-span-2">
              <Textarea
                id="po-form-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-4 text-sm font-semibold">{tf("itemsTabTitle")}</h2>
          {(errors.items || errors.supplierId) && (
            <p role="alert" className="mb-3 text-xs text-[var(--color-danger)]">
              {errors.items ?? errors.supplierId}
            </p>
          )}
          <PurchaseOrderItemEditor
            ref={editorRef}
            suppliers={suppliers}
            taxes={taxes}
            units={units}
            defaultCurrency={currencyCode || defaultCurrency}
            initialSupplierId={order?.supplier_id ?? null}
            initialItems={mode === "edit" ? (order?.items ?? undefined) : undefined}
          />
        </section>

        <div className="flex items-center justify-end gap-2">
          <Link href="/purchase-orders">
            <Button variant="outline">{tf("cancel")}</Button>
          </Link>
          <Button loading={busy} onClick={() => void handleSubmit()}>
            {busy ? tf("saving") : tf("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}