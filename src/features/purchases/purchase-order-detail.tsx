"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Check,
  Copy,
  Pencil,
  Printer,
  Send,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/shared/field";
import { useToast } from "@/stores/use-toast-store";
import { formatMoney, formatDate } from "@/lib/purchases/format";
import { isOrderEditable, availableActions } from "@/lib/purchases/status";
import type { PurchaseOrderAction } from "@/lib/purchases/status";
import type { PurchaseOrderStatus } from "@/lib/purchases/types";
import type { PurchaseOrderWithRelations } from "@/lib/purchases/types";
import {
  purchaseOrderStatusTone,
  PURCHASE_ORDER_STATUS_LABEL_KEYS,
} from "@/features/purchases/status-utils";
import {
  submitPurchaseOrderAction,
  approvePurchaseOrderAction,
  sendPurchaseOrderAction,
  cancelPurchaseOrderAction,
  closePurchaseOrderAction,
  deletePurchaseOrderAction,
  duplicatePurchaseOrderAction,
} from "@/features/purchases/actions";

export interface PurchaseOrderDetailProps {
  order: PurchaseOrderWithRelations;
  actionPermissions: Record<PurchaseOrderAction, boolean>;
  canUpdate: boolean;
  canDelete: boolean;
  canDuplicate: boolean;
  canPrint: boolean;
}

const ACTION_LABEL_KEYS: Record<PurchaseOrderAction, string> = {
  submit: "submit",
  approve: "approve",
  send: "send",
  cancel: "cancel",
  close: "close",
};

export function PurchaseOrderDetail({
  order,
  actionPermissions,
  canUpdate,
  canDelete,
  canDuplicate,
  canPrint,
}: PurchaseOrderDetailProps) {
  const td = useTranslations("purchaseOrderDetails");
  const tActions = useTranslations("purchaseOrderActions");
  const tStatus = useTranslations("purchaseOrderStatus");
  const th = useTranslations("purchaseOrderHistory");
  const ti = useTranslations("purchaseOrderItems");
  const tt = useTranslations("purchaseOrderTotals");
  const tp = useTranslations("purchaseOrderPrint");
  const tList = useTranslations("purchaseOrders");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const router = useRouter();
  const toast = useToast();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const allowed = availableActions(order.status);
  const editable = isOrderEditable(order.status);

  async function run(
    action: () => Promise<{ ok: boolean; key?: string }>,
    successTitle: string
  ) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    setCancelOpen(false);
    setCloseOpen(false);
    setDeleteOpen(false);
    setDuplicateOpen(false);
    setReason("");
    if (result.ok) {
      toast.success({ title: successTitle });
      router.refresh();
    } else {
      toast.error({
        title: tc("common.error"),
        description: tRoot(result.key ?? "authorization.errors.generic"),
      });
    }
  }

  const columns: Column<(typeof order.items)[number]>[] = [
    {
      key: "item",
      header: ti("ingredient"),
      accessor: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {row.description || row.ingredient_id}
          </span>
          {row.supplier_sku && (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {row.supplier_sku}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "qty",
      header: ti("quantity"),
      accessor: (row) => (
        <span className="text-sm font-medium">{row.quantity}</span>
      ),
    },
    {
      key: "price",
      header: ti("unitPrice"),
      accessor: (row) => (
        <span className="text-sm">
          {formatMoney(row.unit_price, order.currency_code)}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "discount",
      header: ti("discount"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.discount_amount && row.discount_amount > 0
            ? `-${formatMoney(row.discount_amount, order.currency_code)}`
            : "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "tax",
      header: ti("tax"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.tax_rate && row.tax_rate > 0
            ? `${row.tax_rate}%`
            : "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "lineTotal",
      header: ti("total"),
      accessor: (row) => (
        <span className="text-sm font-medium">
          {formatMoney(row.total, order.currency_code)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={order.order_number}
        breadcrumbs={[
          { label: tList("title"), href: "/purchase-orders" },
          { label: order.order_number },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/purchase-orders">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="size-4" aria-hidden /> {td("back")}
              </Button>
            </Link>
            {canPrint && (
              <Link href={`/purchase-orders/${order.id}/print`}>
                <Button variant="outline" size="sm">
                  <Printer className="size-4" aria-hidden /> {tp("print")}
                </Button>
              </Link>
            )}
            {canUpdate && editable && (
              <Link href={`/purchase-orders/${order.id}/edit`}>
                <Button variant="outline" size="sm">
                  <Pencil className="size-4" aria-hidden /> {tActions("edit")}
                </Button>
              </Link>
            )}
            {canDuplicate && order.status !== "cancelled" && (
              <Button variant="outline" size="sm" onClick={() => setDuplicateOpen(true)}>
                <Copy className="size-4" aria-hidden /> {tActions("duplicate")}
              </Button>
            )}
            {canDelete && order.status === "draft" && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 className="size-4" aria-hidden /> {tActions("delete")}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge
          status={purchaseOrderStatusTone(order.status)}
          label={tStatus(PURCHASE_ORDER_STATUS_LABEL_KEYS[order.status])}
        />
        <div className="flex flex-wrap items-center gap-2">
          {(["submit", "approve", "send"] as PurchaseOrderAction[]).map(
            (action) =>
              actionPermissions[action] &&
              allowed.includes(action) && (
                <Button
                  key={action}
                  size="sm"
                  onClick={() =>
                    void run(
                      () =>
                        action === "submit"
                          ? submitPurchaseOrderAction({ orderId: order.id })
                          : action === "approve"
                            ? approvePurchaseOrderAction({ orderId: order.id })
                            : sendPurchaseOrderAction({ orderId: order.id }),
                      tActions(`${ACTION_LABEL_KEYS[action]}Title`)
                    )
                  }
                >
                  {action === "approve" ? (
                    <Check className="size-4" aria-hidden />
                  ) : (
                    <Send className="size-4" aria-hidden />
                  )}
                  {tActions(ACTION_LABEL_KEYS[action])}
                </Button>
              )
          )}
          {actionPermissions.close && allowed.includes("close") && (
            <Button size="sm" onClick={() => setCloseOpen(true)}>
              <Check className="size-4" aria-hidden />
              {tActions("close")}
            </Button>
          )}
          {actionPermissions.cancel && allowed.includes("cancel") && (
            <Button size="sm" variant="danger" onClick={() => setCancelOpen(true)}>
              {tActions("cancel")}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">{td("tabOverview")}</TabsTrigger>
          <TabsTrigger value="items">{td("tabItems")}</TabsTrigger>
          <TabsTrigger value="totals">{td("tabTotals")}</TabsTrigger>
          <TabsTrigger value="history">{td("tabHistory")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem label={td("supplier")} value={order.supplierName ?? "—"} />
            <InfoItem
              label={td("orderNumber")}
              value={order.order_number}
            />
            <InfoItem label={td("orderDate")} value={formatDate(order.order_date)} />
            <InfoItem
              label={td("expectedDate")}
              value={formatDate(order.expected_delivery_date)}
            />
            <InfoItem label={td("currency")} value={order.currency_code} />
            <InfoItem
              label={td("status")}
              value={tStatus(PURCHASE_ORDER_STATUS_LABEL_KEYS[order.status])}
            />
            <InfoItem label={td("createdOn")} value={formatDate(order.created_at)} />
            <InfoItem
              label={td("updatedOn")}
              value={formatDate(order.updated_at)}
            />
            {order.internal_notes && (
              <InfoItem label={td("internalNotes")} value={order.internal_notes} />
            )}
            {order.supplier_notes && (
              <InfoItem label={td("supplierNotes")} value={order.supplier_notes} />
            )}
            {order.notes && (
              <InfoItem label={td("notes")} value={order.notes} />
            )}
            {order.shipping_address && (
              <InfoItem
                label={td("shippingAddress")}
                value={order.shipping_address}
              />
            )}
            {order.billing_address && (
              <InfoItem
                label={td("billingAddress")}
                value={order.billing_address}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="items">
          {order.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              {ti("noItems")}
            </p>
          ) : (
            <DataTable
              columns={columns}
              data={order.items}
              rowKey={(row) => row.id}
              striped
            />
          )}
        </TabsContent>

        <TabsContent value="totals">
          <div className="max-w-md">
            <dl className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm">
              <TotalRow label={tt("subtotal")} value={formatMoney(order.subtotal, order.currency_code)} />
              {order.discount_amount ? (
                <TotalRow label={tt("discount")} value={`-${formatMoney(order.discount_amount, order.currency_code)}`} />
              ) : null}
              <TotalRow label={tt("tax")} value={formatMoney(order.tax_amount, order.currency_code)} />
              <TotalRow label={tt("shipping")} value={formatMoney(order.shipping_amount, order.currency_code)} />
              {order.other_charges ? (
                <TotalRow label={tt("otherCharges")} value={formatMoney(order.other_charges, order.currency_code)} />
              ) : null}
              <TotalRow
                label={tt("grandTotal")}
                value={formatMoney(order.total, order.currency_code)}
                strong
              />
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="history">
          {order.history.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              {th("empty")}
            </p>
          ) : (
            <ol className="flex flex-col gap-4">
              {order.history.map((entry) => {
                const fromStatus = entry.from_status as PurchaseOrderStatus | null;
                const toStatus = entry.to_status as PurchaseOrderStatus;
                const actor = entry.changed_by as string | null;
                return (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <StatusBadge
                        status={purchaseOrderStatusTone(toStatus)}
                        label={tStatus(PURCHASE_ORDER_STATUS_LABEL_KEYS[toStatus])}
                        size="sm"
                      />
                      <span className="text-[var(--color-muted-foreground)]">
                        {th("from")}{" "}
                        {fromStatus
                          ? tStatus(PURCHASE_ORDER_STATUS_LABEL_KEYS[fromStatus])
                          : "\u2014"}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {th("by")} {actor?.slice(0, 8) ?? "\u2014"} · {th("at")}{" "}
                      {formatDate(entry.created_at)}
                    </p>
                    {entry.reason && (
                      <p className="text-xs text-[var(--color-muted-foreground)]">
                        {th("reason")}: {entry.reason}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={cancelOpen}
        onOpenChange={(o) => !o && setCancelOpen(false)}
        title={tActions("cancelTitle")}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(
                  () =>
                    cancelPurchaseOrderAction({
                      orderId: order.id,
                      reason: reason.trim() || null,
                    }),
                  tActions("cancel")
                )
              }
            >
              {tActions("confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {tActions("cancelDescription")}
        </p>
        <Field label={tActions("cancelReason")} htmlFor="po-cancel-reason">
          <Textarea
            id="po-cancel-reason"
            rows={3}
            value={reason}
            placeholder={tActions("reasonPlaceholder")}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </Dialog>

      <Dialog
        open={closeOpen}
        onOpenChange={(o) => !o && setCloseOpen(false)}
        title={tActions("closeTitle")}
        footer={
          <>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              {tc("common.cancel")}
            </Button>
            <Button
              loading={busy}
              onClick={() =>
                void run(
                  () => closePurchaseOrderAction({ orderId: order.id }),
                  tActions("close")
                )
              }
            >
              {tActions("confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {tActions("closeDescription")}
        </p>
      </Dialog>

      <Dialog
        open={duplicateOpen}
        onOpenChange={(o) => !o && setDuplicateOpen(false)}
        title={td("duplicateConfirmTitle")}
        footer={
          <>
            <Button variant="outline" onClick={() => setDuplicateOpen(false)}>
              {tc("common.cancel")}
            </Button>
            <Button
              loading={busy}
              onClick={() =>
                void run(
                  () => duplicatePurchaseOrderAction({ orderId: order.id }),
                  tActions("duplicate")
                )
              }
            >
              {tc("common.confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {td("duplicateConfirmDescription")}
        </p>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => !o && setDeleteOpen(false)}
        title={td("deleteConfirmTitle")}
        footer={
          <>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              {tc("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() =>
                void run(
                  () => deletePurchaseOrderAction({ orderId: order.id }),
                  tActions("delete")
                )
              }
            >
              {tActions("confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {td("deleteConfirmDescription")}
        </p>
      </Dialog>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
      <p className="text-xs text-[var(--color-muted-foreground)]">{label}</p>
      <p className="mt-0.5 whitespace-pre-wrap text-sm font-medium">{value}</p>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className={strong ? "text-base font-semibold" : "font-medium"}>{value}</dd>
    </div>
  );
}