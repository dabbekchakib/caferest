"use server";

import { revalidatePath } from "next/cache";
import {
  createOrderSchema,
  updateOrderItemsSchema,
  updateOrderDetailsSchema,
  transitionOrderSchema,
  orderRefSchema,
} from "@/validations/pos";
import { mergeOrdersSchema, splitOrderSchema } from "@/lib/orders/schemas";
import { permissionForTargetStatus } from "@/lib/orders/actions";
import {
  requirePermission,
  requireCurrentEstablishment,
} from "@/services/authorization";
import { writeAudit } from "@/services/audit";
import { fail, ok } from "@/lib/authorization/action-result";
import {
  createPosOrder,
  getPosOrder,
  getPosSettings,
  listPosCustomers,
  mergePosOrders,
  splitPosOrder,
  transitionPosOrder,
  updatePosOrderDetails,
  updatePosOrderItems,
} from "@/services/pos-service";
import type { ActionResult } from "@/lib/authorization/action-result";
import type {
  PosOrderCreateResult,
  PosOrderDetail,
  PosOrderStatus,
} from "@/lib/pos/types";

export type CreatePosOrderInput = {
  clientOperationId?: string | null;
  orderType: string;
  tableId?: string | null;
  diningAreaId?: string | null;
  customerId?: string | null;
  notes?: string | null;
  discountAmount: number;
  items: Array<{ productId: string; quantity: number }>;
};

export type UPosOrderItemsInput = {
  orderId: string;
  items: Array<{ productId: string; quantity: number }>;
};

export type UPosOrderDetailsInput = {
  orderId: string;
  orderType?: string;
  tableId?: string | null;
  diningAreaId?: string | null;
  customerId?: string | null;
  notes?: string | null;
  discountAmount?: number;
};

function toRpcItems(
  items: Array<{ productId: string; quantity: number }>
): Array<{ product_id: string; quantity: number }> {
  return items.map((item) => ({
    product_id: item.productId,
    quantity: item.quantity,
  }));
}

// ---------------------------------------------------------------------------
// Création depuis le panier
// ---------------------------------------------------------------------------

export async function createPosOrderAction(
  input: CreatePosOrderInput
): Promise<ActionResult<PosOrderCreateResult>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = createOrderSchema.safeParse({
      ...input,
      clientOperationId: input.clientOperationId ?? null,
      notes: input.notes ?? null,
      items: input.items,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("orders.create");

    const settings = await getPosSettings(establishmentId);
    const discountAllowed = settings.allowDiscount;
    const discountAmount = discountAllowed
      ? parsed.data.discountAmount
      : 0;
    const status = settings.requireConfirmation ? "open" : "confirmed";
    const clientOperationId = parsed.data.clientOperationId ?? null;

    // Le RPC crée en `open` ; si la confirmation n'est pas requise, on
    // confirme immédiatement (la mutation reste atomique côté serveur).
    const created = await createPosOrder(establishmentId, {
      clientOperationId,
      orderType: parsed.data.orderType,
      tableId: parsed.data.tableId ?? null,
      diningAreaId: parsed.data.diningAreaId ?? null,
      customerId: parsed.data.customerId ?? null,
      notes: parsed.data.notes ?? null,
      discountAmount,
      discountAllowed,
      status: "open",
      items: toRpcItems(parsed.data.items),
    });

    let result = created;
    if (status === "confirmed" && created.status === "open") {
      result = await transitionPosOrder(
        establishmentId,
        created.id,
        "confirmed",
        clientOperationId
      );
    }

    await writeAudit({
      action: "order.created",
      establishmentId,
      entityType: "order",
      entityId: result.id,
      newValues: {
        number: result.orderNumber,
        status: result.status,
        orderType: parsed.data.orderType,
        lineItems: parsed.data.items.length,
        automaticallyConfirmed: status === "confirmed",
      },
    });

    revalidatePath("/pos");
    revalidatePath("/orders");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Mise à jour des lignes (panier d'une commande ouverte)
// ---------------------------------------------------------------------------

export async function updatePosOrderItemsAction(
  input: UPosOrderItemsInput
): Promise<ActionResult<PosOrderCreateResult>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateOrderItemsSchema.safeParse({
      orderId: input.orderId,
      items: input.items,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("orders.update");

    const before = await getPosOrder(establishmentId, parsed.data.orderId);
    if (!before) throw new Error("ORDER_NOT_FOUND");

    const result = await updatePosOrderItems(
      establishmentId,
      parsed.data.orderId,
      toRpcItems(parsed.data.items)
    );

    await writeAudit({
      action: "order.updated",
      establishmentId,
      entityType: "order",
      entityId: parsed.data.orderId,
      oldValues: {
        number: before.orderNumber,
        quantity: before.quantity,
      },
      newValues: {
        number: result.orderNumber,
        quantity: parsed.data.items.reduce(
          (total, item) => total + item.quantity,
          0
        ),
      },
    });

    revalidatePath("/pos");
    revalidatePath("/orders");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Mise à jour des métadonnées (type de vente, table, client, remise, notes)
// ---------------------------------------------------------------------------

export async function updatePosOrderDetailsAction(
  input: UPosOrderDetailsInput
): Promise<ActionResult<PosOrderCreateResult>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = updateOrderDetailsSchema.safeParse({
      orderId: input.orderId,
      orderType: input.orderType,
      tableId: input.tableId,
      diningAreaId: input.diningAreaId,
      customerId: input.customerId,
      notes: input.notes,
      discountAmount: input.discountAmount,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("orders.update");

    const discountAllowed = (await getPosSettings(establishmentId)).allowDiscount;

    const result = await updatePosOrderDetails(
      establishmentId,
      parsed.data.orderId,
      {
        orderType: parsed.data.orderType,
        tableId: parsed.data.tableId,
        diningAreaId: parsed.data.diningAreaId,
        customerId: parsed.data.customerId,
        notes: parsed.data.notes,
        discountAmount: parsed.data.discountAmount,
      },
      discountAllowed
    );

    const auditAction =
      parsed.data.orderType !== undefined
        ? "order.type_changed"
        : parsed.data.tableId !== undefined
          ? "order.table_changed"
          : parsed.data.customerId !== undefined
            ? "order.customer_changed"
            : parsed.data.discountAmount !== undefined
              ? "order.discount_changed"
              : "order.updated";

    await writeAudit({
      action: auditAction,
      establishmentId,
      entityType: "order",
      entityId: parsed.data.orderId,
      newValues: {
        number: result.orderNumber,
        status: result.status,
      },
    });

    revalidatePath("/pos");
    revalidatePath("/orders");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Transitions de statut (confirmer / attendre / reprendre / annuler)
// ---------------------------------------------------------------------------

type TransitionInput = {
  orderId: string;
  toStatus: PosOrderStatus;
  clientOperationId?: string | null;
  reason?: string | null;
};

const ORDER_AUDIT_ACTIONS: Partial<Record<PosOrderStatus, string>> = {
  open: "order.held",
  confirmed: "order.confirmed",
  preparing: "order.preparing",
  ready: "order.ready",
  served: "order.served",
  completed: "order.completed",
  cancelled: "order.cancelled",
};

async function transition(
  input: TransitionInput,
  permissionOverride?: string
): Promise<ActionResult<PosOrderCreateResult>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = transitionOrderSchema.safeParse({
      orderId: input.orderId,
      toStatus: input.toStatus,
      clientOperationId: input.clientOperationId ?? null,
      reason: input.reason ?? null,
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission(permissionOverride ?? permissionForTargetStatus(parsed.data.toStatus));

    const before = await getPosOrder(establishmentId, parsed.data.orderId);
    if (!before) throw new Error("ORDER_NOT_FOUND");

    const result = await transitionPosOrder(
      establishmentId,
      parsed.data.orderId,
      parsed.data.toStatus,
      parsed.data.clientOperationId,
      parsed.data.reason
    );

    const wasHeld = Boolean(before.heldAt);
    const auditAction =
      ORDER_AUDIT_ACTIONS[parsed.data.toStatus] ??
      (wasHeld ? "order.resumed" : "order.updated");

    await writeAudit({
      action: auditAction,
      establishmentId,
      entityType: "order",
      entityId: parsed.data.orderId,
      oldValues: {
        number: before.orderNumber,
        status: before.status,
      },
      newValues: {
        number: result.orderNumber,
        status: result.status,
        reason: parsed.data.reason ?? null,
      },
    });

    revalidatePath("/pos");
    revalidatePath("/orders");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

/** Transition générique (module /orders — toute transition valide). */
export async function transitionPosOrderAction(
  input: TransitionInput
): Promise<ActionResult<PosOrderCreateResult>> {
  return transition(input);
}

export async function confirmPosOrderAction(
  input: Omit<TransitionInput, "toStatus">
): Promise<ActionResult<PosOrderCreateResult>> {
  return transition({ ...input, toStatus: "confirmed" });
}

export async function holdPosOrderAction(
  input: Omit<TransitionInput, "toStatus">
): Promise<ActionResult<PosOrderCreateResult>> {
  return transition({ ...input, toStatus: "open" });
}

export async function resumePosOrderAction(
  input: Omit<TransitionInput, "toStatus">
): Promise<ActionResult<PosOrderCreateResult>> {
  return transition({ ...input, toStatus: "confirmed" });
}

export async function cancelPosOrderAction(
  input: Omit<TransitionInput, "toStatus" | "clientOperationId">
): Promise<ActionResult<PosOrderCreateResult>> {
  return transition({
    ...input,
    toStatus: "cancelled",
    clientOperationId: null,
  });
}

// ---------------------------------------------------------------------------
// Fusion & séparation (module /orders)
// ---------------------------------------------------------------------------

type MergeInput = { sourceOrderId: string; targetOrderId: string };

export async function mergePosOrdersAction(
  input: MergeInput
): Promise<ActionResult<PosOrderCreateResult>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = mergeOrdersSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("orders.update");

    const result = await mergePosOrders(
      establishmentId,
      parsed.data.sourceOrderId,
      parsed.data.targetOrderId
    );

    await writeAudit({
      action: "order.merged",
      establishmentId,
      entityType: "order",
      entityId: parsed.data.targetOrderId,
      newValues: {
        number: result.orderNumber,
        mergedFrom: parsed.data.sourceOrderId,
      },
    });

    revalidatePath("/pos");
    revalidatePath("/orders");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

type SplitInput = {
  sourceOrderId: string;
  orderType: string;
  clientOperationId?: string | null;
  tableId?: string | null;
  diningAreaId?: string | null;
  customerId?: string | null;
  notes?: string | null;
  items: Array<{ id: string }>;
};

export async function splitPosOrderAction(
  input: SplitInput
): Promise<ActionResult<PosOrderCreateResult>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = splitOrderSchema.safeParse({
      sourceOrderId: input.sourceOrderId,
      orderType: input.orderType,
      clientOperationId: input.clientOperationId ?? null,
      tableId: input.tableId ?? null,
      diningAreaId: input.diningAreaId ?? null,
      customerId: input.customerId ?? null,
      notes: input.notes ?? null,
      items: input.items.map((item) => item.id),
    });
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("orders.update");

    const result = await splitPosOrder(establishmentId, {
      sourceOrderId: parsed.data.sourceOrderId,
      orderType: parsed.data.orderType,
      clientOperationId: parsed.data.clientOperationId ?? null,
      tableId: parsed.data.tableId ?? null,
      diningAreaId: parsed.data.diningAreaId ?? null,
      customerId: parsed.data.customerId ?? null,
      notes: parsed.data.notes ?? null,
      items: parsed.data.items,
    });

    await writeAudit({
      action: "order.split",
      establishmentId,
      entityType: "order",
      entityId: parsed.data.sourceOrderId,
      newValues: {
        number: result.orderNumber,
        movedItems: parsed.data.items.length,
      },
    });

    revalidatePath("/pos");
    revalidatePath("/orders");
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}

// ---------------------------------------------------------------------------
// Lecture d'une commande (détail pour le panneau commandes ouvertes)
// ---------------------------------------------------------------------------

export async function getPosOrderByIdAction(
  input: { orderId: string }
): Promise<ActionResult<PosOrderDetail | null>> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    const parsed = orderRefSchema.safeParse(input);
    if (!parsed.success) return fail(parsed.error);

    await requirePermission("orders.view");

    const order = await getPosOrder(establishmentId, parsed.data.orderId);
    return ok(order);
  } catch (error) {
    return fail(error);
  }
}

export async function listPosCustomersAction(): Promise<
  ActionResult<Array<{ id: string; name: string }>>
> {
  try {
    const establishmentId = await requireCurrentEstablishment();
    await requirePermission("pos.access");
    const rows = await listPosCustomers(establishmentId);
    return ok(rows);
  } catch (error) {
    return fail(error);
  }
}