"use server";

import { revalidatePath } from "next/cache";
import {
  createOrderSchema,
  updateOrderItemsSchema,
  updateOrderDetailsSchema,
  transitionOrderSchema,
  orderRefSchema,
} from "@/validations/pos";
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
  transitionPosOrder,
  updatePosOrderDetails,
  updatePosOrderItems,
} from "@/services/pos-service";
import type { ActionResult } from "@/lib/authorization/action-result";
import type { PosOrderCreateResult, PosOrderDetail } from "@/lib/pos/types";

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
  toStatus: "confirmed" | "open" | "cancelled";
  clientOperationId?: string | null;
  reason?: string | null;
};

async function transition(
  input: TransitionInput,
  permission: string
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

    await requirePermission(permission);

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
      parsed.data.toStatus === "cancelled"
        ? "order.cancelled"
        : parsed.data.toStatus === "open"
          ? "order.held"
          : wasHeld
            ? "order.resumed"
            : "order.confirmed";

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

export async function confirmPosOrderAction(
  input: Omit<TransitionInput, "toStatus">
): Promise<ActionResult<PosOrderCreateResult>> {
  return transition({ ...input, toStatus: "confirmed" }, "orders.update");
}

export async function holdPosOrderAction(
  input: Omit<TransitionInput, "toStatus">
): Promise<ActionResult<PosOrderCreateResult>> {
  return transition({ ...input, toStatus: "open" }, "orders.update");
}

export async function resumePosOrderAction(
  input: Omit<TransitionInput, "toStatus">
): Promise<ActionResult<PosOrderCreateResult>> {
  return transition({ ...input, toStatus: "confirmed" }, "orders.update");
}

export async function cancelPosOrderAction(
  input: Omit<TransitionInput, "toStatus" | "clientOperationId">
): Promise<ActionResult<PosOrderCreateResult>> {
  return transition(
    { ...input, toStatus: "cancelled", clientOperationId: null },
    "orders.cancel"
  );
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
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("id, first_name, last_name")
      .eq("establishment_id", establishmentId)
      .eq("is_active", true)
      .order("first_name", { ascending: true })
      .limit(200);
    if (error) return fail(error);

    const rows = (data ?? []).map((customer) => ({
      id: customer.id,
      name: [customer.first_name, customer.last_name]
        .filter(Boolean)
        .join(" ")
        .trim(),
    }));
    return ok(rows);
  } catch (error) {
    return fail(error);
  }
}