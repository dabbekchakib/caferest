"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Check,
  Pencil,
  Printer,
  Send,
  Trash2,
  TrendingUp,
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
import { receiptAvailableActions } from "@/lib/receiving/status";
import type { GoodsReceiptAction } from "@/lib/receiving/status";
import type { GoodsReceiptStatus } from "@/lib/receiving/types";
import type { GoodsReceiptWithRelations } from "@/lib/receiving/types";
import {
  goodsReceiptStatusTone,
  GOODS_RECEIPT_STATUS_LABEL_KEYS,
} from "@/features/receiving/status-utils";
import {
  submitGoodsReceiptAction,
  validateGoodsReceiptAction,
  cancelGoodsReceiptAction,
  deleteGoodsReceiptAction,
} from "@/features/receiving/actions";

export interface GoodsReceiptStockMovement {
  id: string;
  ingredientName: string | null;
  baseQuantity: number | null;
  baseUnitSymbol: string | null;
  unitCost: number;
  totalCost: number;
  lotNumber: string | null;
  batchNumber: string | null;
  expiryDate: string | null;
  locationName: string | null;
  createdAt: string;
}

export interface GoodsReceiptDetailProps {
  receipt: GoodsReceiptWithRelations;
  movements: GoodsReceiptStockMovement[];
  actionPermissions: Record<GoodsReceiptAction, boolean>;
  canUpdate: boolean;
  canDelete: boolean;
  canPrint: boolean;
  currency: string;
}

export function GoodsReceiptDetail({
  receipt,
  movements,
  actionPermissions,
  canUpdate,
  canDelete,
  canPrint,
  currency,
}: GoodsReceiptDetailProps) {
  const td = useTranslations("receiptDetails");
  const tActions = useTranslations("receiptActions");
  const tStatus = useTranslations("receiptStatus");
  const th = useTranslations("receiptHistory");
  const ti = useTranslations("receiptItems");
  const tt = useTranslations("receiptTotals");
  const ts = useTranslations("stockReceipt");
  const tp = useTranslations("receiptPrint");
  const tList = useTranslations("receipts");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const router = useRouter();
  const toast = useToast();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [validateOpen, setValidateOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const allowed = receiptAvailableActions(receipt.status);

  const money = (amount: number) =>
    formatMoney(amount, receipt.currencyCode ?? currency);

  async function run(
    action: () => Promise<{ ok: boolean; key?: string }>,
    successTitle: string
  ) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    setCancelOpen(false);
    setValidateOpen(false);
    setDeleteOpen(false);
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

  const itemColumns: Column<(typeof receipt.items)[number]>[] = [
    {
      key: "ingredient",
      header: ti("ingredient"),
      accessor: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">
            {row.ingredientName ?? row.ingredient_id}
          </span>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {row.ingredientSku ?? ""}
            {row.purchaseUnitSymbol ? ` · ${row.purchaseUnitSymbol}` : ""}
          </span>
          {(row.lot_number || row.batch_number || row.expiry_date) && (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              {row.lot_number ? `L ${row.lot_number}` : ""}
              {row.batch_number ? ` · ${row.batch_number}` : ""}
              {row.expiry_date ? ` · ${formatDate(row.expiry_date)}` : ""}
            </span>
          )}
        </span>
      ),
    },
    {
      key: "ordered",
      header: ti("ordered"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.ordered_quantity}
        </span>
      ),
    },
    {
      key: "received",
      header: ti("received"),
      accessor: (row) => (
        <span className="text-sm font-medium">{row.received_quantity}</span>
      ),
    },
    {
      key: "accepted",
      header: ti("accepted"),
      accessor: (row) => (
        <span className="text-sm font-medium">{row.accepted_quantity}</span>
      ),
    },
    {
      key: "rejected",
      header: ti("rejected"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.rejected_quantity}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "unitPrice",
      header: ti("unitPrice"),
      accessor: (row) => <span className="text-sm">{money(row.unit_price)}</span>,
      hideOnMobile: true,
    },
    {
      key: "lineTotal",
      header: ti("total"),
      accessor: (row) => (
        <span className="text-sm font-medium">{money(row.total_amount)}</span>
      ),
    },
  ];

  const movementColumns: Column<GoodsReceiptStockMovement>[] = [
    {
      key: "ingredient",
      header: ts("reference"),
      accessor: (row) => (
        <span className="truncate text-sm font-medium">
          {row.ingredientName ?? row.id}
        </span>
      ),
    },
    {
      key: "quantity",
      header: ts("quantity"),
      accessor: (row) => (
        <span className="text-sm font-medium">
          {row.baseQuantity ?? "—"}
          {row.baseUnitSymbol ? ` ${row.baseUnitSymbol}` : ""}
        </span>
      ),
    },
    {
      key: "unitCost",
      header: ts("unitCost"),
      accessor: (row) => <span className="text-sm">{money(row.unitCost)}</span>,
      hideOnMobile: true,
    },
    {
      key: "totalCost",
      header: ts("totalCost"),
      accessor: (row) => (
        <span className="text-sm font-medium">{money(row.totalCost)}</span>
      ),
      hideOnMobile: true,
    },
    {
      key: "location",
      header: td("location"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {row.locationName ?? "—"}
        </span>
      ),
      hideOnMobile: true,
    },
    {
      key: "date",
      header: th("at"),
      accessor: (row) => (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {formatDate(row.createdAt)}
        </span>
      ),
      hideOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title={receipt.receipt_number}
        breadcrumbs={[
          { label: tList("title"), href: "/receipts" },
          { label: receipt.receipt_number },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/receipts">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="size-4" aria-hidden /> {td("back")}
              </Button>
            </Link>
            {canPrint && (
              <Link href={`/receipts/${receipt.id}/print`}>
                <Button variant="outline" size="sm">
                  <Printer className="size-4" aria-hidden /> {tp("print")}
                </Button>
              </Link>
            )}
            {canUpdate &&
              (receipt.status === "draft" || receipt.status === "pending_validation") && (
                <Link href={`/receipts/${receipt.id}/edit`}>
                  <Button variant="outline" size="sm">
                    <Pencil className="size-4" aria-hidden /> {tActions("edit")}
                  </Button>
                </Link>
              )}
            {canDelete && receipt.status === "draft" && (
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
          status={goodsReceiptStatusTone(receipt.status)}
          label={tStatus(GOODS_RECEIPT_STATUS_LABEL_KEYS[receipt.status])}
        />
        <div className="flex flex-wrap items-center gap-2">
          {actionPermissions.submit && allowed.includes("submit") && (
            <Button
              size="sm"
              onClick={() =>
                void run(
                  () => submitGoodsReceiptAction({ receiptId: receipt.id }),
                  tActions("submitted")
                )
              }
            >
              <Send className="size-4" aria-hidden /> {tActions("submit")}
            </Button>
          )}
          {actionPermissions.validate && allowed.includes("validate") && (
            <Button size="sm" onClick={() => setValidateOpen(true)}>
              <Check className="size-4" aria-hidden /> {tActions("validate")}
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
          {movements.length > 0 && (
            <TabsTrigger value="stock">{ts("title")}</TabsTrigger>
          )}
          <TabsTrigger value="history">{td("tabHistory")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem label={td("supplier")} value={receipt.supplierName ?? "—"} />
            <InfoItem
              label={td("receiptNumber")}
              value={receipt.receipt_number}
            />
            <InfoItem
              label={td("receiptDate")}
              value={formatDate(receipt.receipt_date)}
            />
            <InfoItem
              label={td("purchaseOrder")}
              value={receipt.purchaseOrderNumber ?? "—"}
            />
            <InfoItem label={td("location")} value={receipt.locationName ?? "—"} />
            <InfoItem
              label={td("status")}
              value={tStatus(GOODS_RECEIPT_STATUS_LABEL_KEYS[receipt.status])}
            />
            <InfoItem
              label={td("createdOn")}
              value={formatDate(receipt.created_at)}
            />
            <InfoItem
              label={td("updatedOn")}
              value={formatDate(receipt.updated_at)}
            />
            <InfoItem
              label={td("receivedBy")}
              value={receipt.receivedByName ?? "—"}
            />
            <InfoItem
              label={td("validatedBy")}
              value={receipt.validatedByName ?? "—"}
            />
            {receipt.validated_at && (
              <InfoItem
                label={td("receivedOn")}
                value={formatDate(receipt.validated_at)}
              />
            )}
            {receipt.delivery_note_number && (
              <InfoItem
                label={td("deliveryNote")}
                value={receipt.delivery_note_number}
              />
            )}
            {receipt.supplier_invoice_number && (
              <InfoItem
                label={td("supplierInvoice")}
                value={receipt.supplier_invoice_number}
              />
            )}
            {receipt.notes && (
              <InfoItem label={td("notes")} value={receipt.notes} />
            )}
            {receipt.internal_notes && (
              <InfoItem label={td("internalNotes")} value={receipt.internal_notes} />
            )}
            {receipt.status === "cancelled" && receipt.cancellation_reason && (
              <InfoItem
                label={th("reason")}
                value={receipt.cancellation_reason}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="items">
          {receipt.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              {ti("noItems")}
            </p>
          ) : (
            <DataTable
              columns={itemColumns}
              data={receipt.items}
              rowKey={(row) => row.id}
              striped
            />
          )}
        </TabsContent>

        <TabsContent value="totals">
          <div className="max-w-md">
            <dl className="divide-y divide-[var(--color-border)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm">
              <TotalRow label={tt("subtotal")} value={money(receipt.subtotal)} />
              {receipt.discount_amount ? (
                <TotalRow
                  label={tt("discount")}
                  value={`-${money(receipt.discount_amount)}`}
                />
              ) : null}
              <TotalRow label={tt("tax")} value={money(receipt.tax_amount)} />
              <TotalRow
                label={tt("grandTotal")}
                value={money(receipt.total_amount)}
                strong
              />
            </dl>
          </div>
        </TabsContent>

        {movements.length > 0 && (
          <TabsContent value="stock">
            <div className="mb-3 flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
              <TrendingUp className="size-4" aria-hidden />
              {ts("description")}
            </div>
            <DataTable
              columns={movementColumns}
              data={movements}
              rowKey={(row) => row.id}
              striped
            />
          </TabsContent>
        )}

        <TabsContent value="history">
          {receipt.history.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
              {th("empty")}
            </p>
          ) : (
            <ol className="flex flex-col gap-4">
              {receipt.history.map((entry) => {
                const fromStatus = entry.from_status as GoodsReceiptStatus | null;
                const toStatus = entry.to_status as GoodsReceiptStatus;
                const actor = entry.changed_by as string | null;
                return (
                  <li
                    key={entry.id}
                    className="flex flex-col gap-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <StatusBadge
                        status={goodsReceiptStatusTone(toStatus)}
                        label={tStatus(GOODS_RECEIPT_STATUS_LABEL_KEYS[toStatus])}
                        size="sm"
                      />
                      <span className="text-[var(--color-muted-foreground)]">
                        {th("from")}{" "}
                        {fromStatus
                          ? tStatus(GOODS_RECEIPT_STATUS_LABEL_KEYS[fromStatus])
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
        open={validateOpen}
        onOpenChange={(o) => !o && setValidateOpen(false)}
        title={tActions("validateTitle")}
        footer={
          <>
            <Button variant="outline" onClick={() => setValidateOpen(false)}>
              {tc("common.cancel")}
            </Button>
            <Button
              loading={busy}
              onClick={() =>
                void run(
                  () => validateGoodsReceiptAction({ receiptId: receipt.id }),
                  tActions("validated")
                )
              }
            >
              {tActions("confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {tActions("validateDescription")}
        </p>
      </Dialog>

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
                    cancelGoodsReceiptAction({
                      receiptId: receipt.id,
                      reason: reason.trim() || null,
                    }),
                  tActions("cancelled")
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
        <Field label={tActions("cancelReason")} htmlFor="receipt-cancel-reason">
          <Textarea
            id="receipt-cancel-reason"
            rows={3}
            value={reason}
            placeholder={tActions("reasonPlaceholder")}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(o) => !o && setDeleteOpen(false)}
        title={td("deleteTitle")}
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
                  () => deleteGoodsReceiptAction({ receiptId: receipt.id }),
                  tActions("deleted")
                )
              }
            >
              {tActions("confirm")}
            </Button>
          </>
        }
      >
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {td("deleteDescription")}
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