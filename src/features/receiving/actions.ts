"use server";

import { revalidatePath } from "next/cache";
import {
  createGoodsReceiptSchema,
  updateGoodsReceiptSchema,
  goodsReceiptActionSchema,
} from "@/validations/receiving";
import {
  requirePermission,
  requireAnyPermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { writeAudit } from "@/services/audit";
import { AuthorizationError } from "@/lib/authorization/errors";
import {
  createGoodsReceipt,
  updateGoodsReceipt,
  deleteGoodsReceipt,
  submitGoodsReceipt,
  validateGoodsReceipt,
  cancelGoodsReceipt,
  getGoodsReceipt,
  listReceivablePurchaseOrders,
  listInventoryLocations,
  nextGoodsReceiptNumberPreview,
} from "@/services/receiving-service";
import type { ReceivablePurchaseOrder } from "@/lib/receiving/types";
import { receiptTargetStatus, receiptAvailableActions } from "@/lib/receiving/status";
import type { GoodsReceiptStatus } from "@/lib/receiving/types";
import {
  ok,
  okVoid,
  fail,
  type ActionResult,
} from "@/lib/authorization/action-result";

type GoodsReceiptActionInput = {
  receiptId: string;
  reason?: string | null;
};

export interface InventoryLocationLite {
  id: string;
  name: string;
  code: string;
}

function toTrimmedOrNull(value?: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function loadReceiptOrThrow(
  receiptId: string,
  establishmentId: string
): Promise<{ status: GoodsReceiptStatus; receiptNumber: string }> {
  const receipt = await getGoodsReceipt(establishmentId, receiptId);
  if (!receipt) throw new AuthorizationError("GOODS_RECEIPT_NOT_FOUND");
  return { status: receipt.status, receiptNumber: receipt.receipt_number };
}

// ---------------------------------------------------------------------------
// Builder data (read-only, used by the create/edit form)
// ---------------------------------------------------------------------------

export async function getReceivableOrdersAction(): Promise<
  ReceivablePurchaseOrder[]
> {
  const establishmentId = await requireCurrentEstablishment();
  await requireAnyPermission(["goods_receipts.create", "goods_receipts.update"]);
  return listReceivablePurchaseOrders(establishmentId);
}

export async function getInventoryLocationsAction(): Promise<
  InventoryLocationLite[]
> {
  const establishmentId = await requireCurrentEstablishment();
  await requireAnyPermission(["goods_receipts.create", "goods_receipts.update"]);
  const locations = await listInventoryLocations(establishmentId);
  return locations.map((location) => ({
    id: location.id,
    name: location.name,
    code: location.code,
  }));
}

export async function nextReceiptNumberPreviewAction(): Promise<string> {
  const establishmentId = await requireCurrentEstablishment();
  await requireAnyPermission(["goods_receipts.create", "goods_receipts.update"]);
  return nextGoodsReceiptNumberPreview(establishmentId);
}

// ---------------------------------------------------------------------------
// Create / update / delete
// ---------------------------------------------------------------------------

export interface ReceiptLineActionInput {
  purchaseOrderItemId: string;
  ingredientId: string;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  lotNumber?: string | null;
  batchNumber?: string | null;
  expiryDate?: string | null;
  notes?: string | null;
  sortOrder: number;
}

export interface CreateGoodsReceiptActionInput {
  purchaseOrderId: string;
  receiptDate: string | Date | null;
  inventoryLocationId: string | null;
  deliveryNoteNumber?: string | null;
  supplierInvoiceNumber?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  items: ReceiptLineActionInput[];
}

export async function createGoodsReceiptAction(
  input: CreateGoodsReceiptActionInput
): Promise<ActionResult<{ id: string; receiptNumber: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createGoodsReceiptSchema.safeParse({
      ...input,
      establishmentId,
      receiptDate: input.receiptDate ?? null,
      inventoryLocationId: input.inventoryLocationId ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("goods_receipts.create");

    const { items, establishmentId: estId, ...rest } = parsed.data;

    const created = await createGoodsReceipt(estId, {
      purchaseOrderId: rest.purchaseOrderId,
      receiptDate: rest.receiptDate ? new Date(rest.receiptDate) : null,
      inventoryLocationId: rest.inventoryLocationId ?? null,
      deliveryNoteNumber: toTrimmedOrNull(rest.deliveryNoteNumber),
      supplierInvoiceNumber: toTrimmedOrNull(rest.supplierInvoiceNumber),
      notes: toTrimmedOrNull(rest.notes),
      internalNotes: toTrimmedOrNull(rest.internalNotes),
      items: items.map((line) => ({
        purchaseOrderItemId: line.purchaseOrderItemId,
        ingredientId: line.ingredientId,
        receivedQuantity: line.receivedQuantity,
        acceptedQuantity: line.acceptedQuantity,
        rejectedQuantity: line.rejectedQuantity,
        lotNumber: toTrimmedOrNull(line.lotNumber),
        batchNumber: toTrimmedOrNull(line.batchNumber),
        expiryDate: line.expiryDate ? String(line.expiryDate) : null,
        notes: toTrimmedOrNull(line.notes),
        sortOrder: line.sortOrder,
      })),
    });

    await writeAudit({
      action: "goods_receipt.created",
      establishmentId: estId,
      entityType: "goods_receipt",
      entityId: created.id,
      newValues: {
        receiptNumber: created.receipt_number,
        status: created.status,
        total: created.total_amount,
        purchaseOrder: created.purchaseOrderNumber,
      },
    });

    revalidatePath("/receipts");
    revalidatePath(`/purchase-orders/${rest.purchaseOrderId}`);
    return ok({ id: created.id, receiptNumber: created.receipt_number });
  } catch (error) {
    return fail(error);
  }
}

export interface UpdateGoodsReceiptActionInput
  extends CreateGoodsReceiptActionInput {
  receiptId: string;
}

export async function updateGoodsReceiptAction(
  input: UpdateGoodsReceiptActionInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateGoodsReceiptSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("goods_receipts.update");

    const { id, items, ...rest } = parsed.data;

    const updated = await updateGoodsReceipt(establishmentId, id, {
      purchaseOrderId: rest.purchaseOrderId,
      receiptDate: rest.receiptDate ? new Date(rest.receiptDate) : null,
      inventoryLocationId: rest.inventoryLocationId ?? null,
      deliveryNoteNumber: toTrimmedOrNull(rest.deliveryNoteNumber),
      supplierInvoiceNumber: toTrimmedOrNull(rest.supplierInvoiceNumber),
      notes: toTrimmedOrNull(rest.notes),
      internalNotes: toTrimmedOrNull(rest.internalNotes),
      items: items.map((line) => ({
        purchaseOrderItemId: line.purchaseOrderItemId,
        ingredientId: line.ingredientId,
        receivedQuantity: line.receivedQuantity,
        acceptedQuantity: line.acceptedQuantity,
        rejectedQuantity: line.rejectedQuantity,
        lotNumber: toTrimmedOrNull(line.lotNumber),
        batchNumber: toTrimmedOrNull(line.batchNumber),
        expiryDate: line.expiryDate ? String(line.expiryDate) : null,
        notes: toTrimmedOrNull(line.notes),
        sortOrder: line.sortOrder,
      })),
    });

    await writeAudit({
      action: "goods_receipt.updated",
      establishmentId,
      entityType: "goods_receipt",
      entityId: id,
      newValues: {
        receiptNumber: updated.receipt_number,
        status: updated.status,
        total: updated.total_amount,
        purchaseOrder: updated.purchaseOrderNumber,
      },
    });

    revalidatePath(`/receipts/${id}`);
    revalidatePath("/receipts");
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function deleteGoodsReceiptAction(
  input: GoodsReceiptActionInput
): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = goodsReceiptActionSchema.safeParse({
      id: input.receiptId,
      reason: input.reason ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("goods_receipts.delete");

    await deleteGoodsReceipt(establishmentId, parsed.data.id);

    await writeAudit({
      action: "goods_receipt.deleted",
      establishmentId,
      entityType: "goods_receipt",
      entityId: parsed.data.id,
    });

    revalidatePath("/receipts");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Workflow transitions
// ---------------------------------------------------------------------------

async function transition(
  input: GoodsReceiptActionInput,
  permission: string,
  action: "submit" | "validate" | "cancel"
): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = goodsReceiptActionSchema.safeParse({
      id: input.receiptId,
      reason: input.reason ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission(permission);

    const { status, receiptNumber } = await loadReceiptOrThrow(
      parsed.data.id,
      establishmentId
    );
    if (!receiptAvailableActions(status).includes(action)) {
      throw new AuthorizationError("GOODS_RECEIPT_INVALID_STATUS");
    }

    switch (action) {
      case "submit":
        await submitGoodsReceipt(establishmentId, parsed.data.id);
        break;
      case "validate":
        await validateGoodsReceipt(establishmentId, parsed.data.id);
        break;
      case "cancel":
        await cancelGoodsReceipt(
          establishmentId,
          parsed.data.id,
          parsed.data.reason ?? null
        );
        break;
    }

    const target = receiptTargetStatus(status, action);
    const auditAction =
      action === "validate" ? "goods_receipt.validated" : action === "submit" ? "goods_receipt.submitted" : "goods_receipt.cancelled";

    await writeAudit({
      action: auditAction,
      establishmentId,
      entityType: "goods_receipt",
      entityId: parsed.data.id,
      oldValues: { status, receiptNumber },
      newValues: { status: target, reason: parsed.data.reason ?? null },
    });

    if (action === "validate") {
      await writeAudit({
        action: "stock.received",
        establishmentId,
        entityType: "goods_receipt",
        entityId: parsed.data.id,
        newValues: { receiptNumber },
      });
    }

    revalidatePath(`/receipts/${parsed.data.id}`);
    revalidatePath("/receipts");
    revalidatePath("/purchase-orders");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function submitGoodsReceiptAction(
  input: GoodsReceiptActionInput
): Promise<ActionResult> {
  return transition(input, "goods_receipts.submit", "submit");
}

export async function validateGoodsReceiptAction(
  input: GoodsReceiptActionInput
): Promise<ActionResult> {
  return transition(input, "goods_receipts.validate", "validate");
}

export async function cancelGoodsReceiptAction(
  input: GoodsReceiptActionInput
): Promise<ActionResult> {
  return transition(input, "goods_receipts.cancel", "cancel");
}