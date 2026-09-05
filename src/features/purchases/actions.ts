"use server";

import { revalidatePath } from "next/cache";
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  purchaseOrderActionSchema,
} from "@/validations/purchases";
import {
  requirePermission,
  requireAnyPermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { getSupplierCatalog } from "@/services/suppliers-service";
import { writeAudit } from "@/services/audit";
import { AuthorizationError } from "@/lib/authorization/errors";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
  duplicatePurchaseOrder,
  submitPurchaseOrder,
  approvePurchaseOrder,
  sendPurchaseOrder,
  cancelPurchaseOrder,
  closePurchaseOrder,
  getPurchaseOrder,
} from "@/services/purchases-service";
import type { PurchaseOrderLineInput } from "@/lib/purchases/types";
import { availableActions } from "@/lib/purchases/status";
import type { PurchaseOrderStatus } from "@/lib/purchases/types";
import {
  ok,
  okVoid,
  fail,
  type ActionResult,
} from "@/lib/authorization/action-result";

type PurchaseOrderActionInput = {
  orderId: string;
  reason?: string | null;
};

async function loadOrderOrThrow(
  orderId: string,
  establishmentId: string
): Promise<{ status: PurchaseOrderStatus; supplierName: string | null }> {
  const order = await getPurchaseOrder(establishmentId, orderId);
  if (!order) throw new Error("purchase_order_not_found");
  return { status: order.status, supplierName: order.supplierName };
}

function toTrimmedOrNull(value?: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

// ---------------------------------------------------------------------------
// Create / update / delete / duplicate
// ---------------------------------------------------------------------------

export type PurchaseOrderLineActionInput = PurchaseOrderLineInput;

/** Catalog offer a form item-editor can compose an order line from. */
export interface CatalogLineOffer {
  ingredientSupplierId: string;
  ingredientId: string;
  ingredientName: string;
  supplierSku: string | null;
  purchaseUnitId: string | null;
  purchaseUnitSymbol: string | null;
  purchasePrice: number;
}

/** Live catalog of the selected supplier (read-only for the PO builder). */
export async function getPurchaseCatalogAction(input: {
  supplierId: string;
}): Promise<CatalogLineOffer[]> {
  const establishmentId = await requireCurrentEstablishment();
  await requireAnyPermission(["purchases.create", "purchases.update"]);
  const catalog = await getSupplierCatalog(establishmentId, input.supplierId);
  return catalog.map((item) => ({
    ingredientSupplierId: item.id,
    ingredientId: item.ingredient_id,
    ingredientName: item.ingredientName,
    supplierSku: item.supplier_sku,
    purchaseUnitId: item.purchase_unit_id,
    purchaseUnitSymbol: item.purchaseUnitSymbol,
    purchasePrice: item.purchase_price,
  }));
}

export interface CreatePurchaseOrderActionInput {
  supplierId: string;
  orderDate: string | Date;
  expectedDeliveryDate?: string | Date | null;
  currencyCode: string;
  shippingAmount?: number;
  otherCharges?: number;
  notes?: string | null;
  internalNotes?: string | null;
  supplierNotes?: string | null;
  shippingAddress?: string | null;
  billingAddress?: string | null;
  items: PurchaseOrderLineActionInput[];
}

export async function createPurchaseOrderAction(
  input: CreatePurchaseOrderActionInput
): Promise<ActionResult<{ id: string; orderNumber: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createPurchaseOrderSchema.safeParse({
      ...input,
      establishmentId,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("purchases.create");

    const { items, establishmentId: estId, ...rest } = parsed.data;

    const created = await createPurchaseOrder(estId, {
      ...rest,
      orderDate: rest.orderDate,
      expectedDeliveryDate: rest.expectedDeliveryDate ?? null,
      notes: toTrimmedOrNull(rest.notes),
      internalNotes: toTrimmedOrNull(rest.internalNotes),
      supplierNotes: toTrimmedOrNull(rest.supplierNotes),
      shippingAddress: toTrimmedOrNull(rest.shippingAddress),
      billingAddress: toTrimmedOrNull(rest.billingAddress),
      items: items.map((line) => ({
        ...line,
        purchaseUnitId: line.purchaseUnitId ?? null,
        taxId: line.taxId ?? null,
        description: toTrimmedOrNull(line.description),
        supplierSku: toTrimmedOrNull(line.supplierSku),
        notes: toTrimmedOrNull(line.notes),
      })),
    });

    await writeAudit({
      action: "purchase_order.created",
      establishmentId: estId,
      entityType: "purchase_order",
      entityId: created.id,
      newValues: {
        orderNumber: created.order_number,
        status: created.status,
        total: created.total,
        supplier: created.supplierName,
      },
    });

    revalidatePath("/purchase-orders");
    return ok({ id: created.id, orderNumber: created.order_number });
  } catch (error) {
    return fail(error);
  }
}

export interface UpdatePurchaseOrderActionInput
  extends CreatePurchaseOrderActionInput {
  orderId: string;
}

export async function updatePurchaseOrderAction(
  input: UpdatePurchaseOrderActionInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updatePurchaseOrderSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("purchases.update");

    const { id, items, ...rest } = parsed.data;

    const updated = await updatePurchaseOrder(establishmentId, id, {
      ...rest,
      orderDate: rest.orderDate,
      expectedDeliveryDate: rest.expectedDeliveryDate ?? null,
      notes: toTrimmedOrNull(rest.notes),
      internalNotes: toTrimmedOrNull(rest.internalNotes),
      supplierNotes: toTrimmedOrNull(rest.supplierNotes),
      shippingAddress: toTrimmedOrNull(rest.shippingAddress),
      billingAddress: toTrimmedOrNull(rest.billingAddress),
      items: items.map((line) => ({
        ...line,
        purchaseUnitId: line.purchaseUnitId ?? null,
        taxId: line.taxId ?? null,
        description: toTrimmedOrNull(line.description),
        supplierSku: toTrimmedOrNull(line.supplierSku),
        notes: toTrimmedOrNull(line.notes),
      })),
    });

    await writeAudit({
      action: "purchase_order.updated",
      establishmentId,
      entityType: "purchase_order",
      entityId: id,
      newValues: {
        orderNumber: updated.order_number,
        status: updated.status,
        total: updated.total,
        supplier: updated.supplierName,
      },
    });

    revalidatePath(`/purchase-orders/${id}`);
    revalidatePath("/purchase-orders");
    return ok({ id });
  } catch (error) {
    return fail(error);
  }
}

export async function deletePurchaseOrderAction(
  input: PurchaseOrderActionInput
): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = purchaseOrderActionSchema.safeParse({
      id: input.orderId,
      reason: input.reason ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("purchases.delete");

    await deletePurchaseOrder(establishmentId, parsed.data.id);

    await writeAudit({
      action: "purchase_order.deleted",
      establishmentId,
      entityType: "purchase_order",
      entityId: parsed.data.id,
    });

    revalidatePath("/purchase-orders");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function duplicatePurchaseOrderAction(
  input: PurchaseOrderActionInput
): Promise<ActionResult<{ id: string; orderNumber: string }>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = purchaseOrderActionSchema.safeParse({
      id: input.orderId,
      reason: input.reason ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("purchases.duplicate");

    const newId = await duplicatePurchaseOrder(
      establishmentId,
      parsed.data.id
    );
    const created = await getPurchaseOrder(establishmentId, newId);

    await writeAudit({
      action: "purchase_order.duplicated",
      establishmentId,
      entityType: "purchase_order",
      entityId: newId,
      newValues: {
        sourceId: parsed.data.id,
        orderNumber: created?.order_number ?? null,
      },
    });

    revalidatePath("/purchase-orders");
    return ok({
      id: newId,
      orderNumber: created?.order_number ?? "",
    });
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Workflow transitions
// ---------------------------------------------------------------------------

async function transition(
  input: PurchaseOrderActionInput,
  permission: string,
  action: "submit" | "approve" | "send" | "cancel" | "close"
): Promise<ActionResult> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = purchaseOrderActionSchema.safeParse({
      id: input.orderId,
      reason: input.reason ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission(permission);

    const { status, supplierName } = await loadOrderOrThrow(
      parsed.data.id,
      establishmentId
    );
    if (!availableActions(status).includes(action)) {
      throw new AuthorizationError("PURCHASE_ORDER_INVALID_STATUS");
    }

    switch (action) {
      case "submit":
        await submitPurchaseOrder(establishmentId, parsed.data.id);
        break;
      case "approve":
        await approvePurchaseOrder(establishmentId, parsed.data.id);
        break;
      case "send":
        await sendPurchaseOrder(establishmentId, parsed.data.id);
        break;
      case "cancel":
        await cancelPurchaseOrder(
          establishmentId,
          parsed.data.id,
          parsed.data.reason ?? null
        );
        break;
      case "close":
        await closePurchaseOrder(establishmentId, parsed.data.id);
        break;
    }

    await writeAudit({
      action: `purchase_order.${action === "close" ? "closed" : action === "submit" ? "submitted" : action === "approve" ? "approved" : action === "send" ? "sent" : "cancelled"}` as const,
      establishmentId,
      entityType: "purchase_order",
      entityId: parsed.data.id,
      oldValues: { status, supplier: supplierName },
      newValues: { reason: parsed.data.reason ?? null },
    });

    revalidatePath(`/purchase-orders/${parsed.data.id}`);
    revalidatePath("/purchase-orders");
    return okVoid();
  } catch (error) {
    return fail(error);
  }
}

export async function submitPurchaseOrderAction(
  input: PurchaseOrderActionInput
): Promise<ActionResult> {
  return transition(input, "purchases.submit", "submit");
}

export async function approvePurchaseOrderAction(
  input: PurchaseOrderActionInput
): Promise<ActionResult> {
  return transition(input, "purchases.approve", "approve");
}

export async function sendPurchaseOrderAction(
  input: PurchaseOrderActionInput
): Promise<ActionResult> {
  return transition(input, "purchases.send", "send");
}

export async function cancelPurchaseOrderAction(
  input: PurchaseOrderActionInput
): Promise<ActionResult> {
  return transition(input, "purchases.cancel", "cancel");
}

export async function closePurchaseOrderAction(
  input: PurchaseOrderActionInput
): Promise<ActionResult> {
  return transition(input, "purchases.close", "close");
}