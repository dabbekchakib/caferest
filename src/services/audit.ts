import type { Json } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { getAuthorizationContext } from "./authorization";

export interface AuditEntry {
  action: string;
  establishmentId: string | null;
  entityType?: string | null;
  entityId?: string | null;
  oldValues?: Json | null;
  newValues?: Json | null;
}

const AUDIT_ACTIONS = [
  "user.created",
  "user.invited",
  "user.updated",
  "user.deactivated",
  "user.activated",
  "user.role.granted",
  "user.role.revoked",
  "user.deleted",
  "role.created",
  "role.updated",
  "role.duplicated",
  "role.deleted",
  "role.toggled",
  "role.permissions.updated",
  "establishment.switched",
  "unit.created",
  "unit.updated",
  "unit.deleted",
  "unit.toggled",
  "unit_conversion.created",
  "unit_conversion.updated",
  "unit_conversion.deleted",
  "unit_conversion.toggled",
  "category.created",
  "category.updated",
  "category.deleted",
  "category.moved",
  "category.reordered",
  "category.activated",
  "category.deactivated",
  "product.created",
  "product.updated",
  "product.deleted",
  "product.activated",
  "product.deactivated",
  "product.availability_changed",
  "product.price_changed",
  "product.reordered",
  "product.image_uploaded",
  "product.image_deleted",
  "ingredient.created",
  "ingredient.updated",
  "ingredient.deleted",
  "ingredient.activated",
  "ingredient.deactivated",
  "ingredient.stock_tracking_changed",
  "ingredient.cost_changed",
  "ingredient.reordered",
  "ingredient.image_uploaded",
  "ingredient.image_deleted",
  "recipe.created",
  "recipe.updated",
  "recipe.deleted",
  "recipe.activated",
  "recipe.deactivated",
  "recipe.archived",
  "recipe.duplicated",
  "recipe.set_default",
  "recipe.item_added",
  "recipe.item_updated",
  "recipe.item_removed",
  "recipe.reordered",
  "recipe_yield.created",
  "recipe_yield.updated",
  "recipe_yield.deleted",
  "recipe_yield.activated",
  "recipe_yield.deactivated",
  "recipe_yield.calculated",
  "supplier.created",
  "supplier.updated",
  "supplier.deleted",
  "supplier.activated",
  "supplier.deactivated",
  "supplier.contact.created",
  "supplier.contact.updated",
  "supplier.contact.deleted",
  "ingredient_supplier.created",
  "ingredient_supplier.updated",
  "ingredient_supplier.deleted",
  "ingredient_supplier.preferred",
  "supplier_price.created",
  "supplier_price.updated",
  "purchase_order.created",
  "purchase_order.updated",
  "purchase_order.submitted",
  "purchase_order.approved",
  "purchase_order.sent",
  "purchase_order.cancelled",
  "purchase_order.closed",
  "purchase_order.deleted",
  "purchase_order.duplicated",
  "goods_receipt.created",
  "goods_receipt.updated",
  "goods_receipt.submitted",
  "goods_receipt.validated",
  "goods_receipt.cancelled",
  "goods_receipt.deleted",
  "stock.received",
  "stock.receipt.created",
  "stocktake.created",
  "stocktake.updated",
  "stocktake.deleted",
  "stocktake.started",
  "stocktake.count_updated",
  "stocktake.completed",
  "stocktake.approved",
  "stocktake.validated",
  "stocktake.cancelled",
  "stocktake.adjustment_created",
  "stock.adjusted",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Append an audit trail entry. Runs with the user's own session so RLS enforces
 * `audit_logs_write`; failures are never fatal to the main operation.
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await createClient();
    const context = await getAuthorizationContext();

    await supabase.from("audit_logs").insert({
      action: entry.action,
      establishment_id: entry.establishmentId,
      user_id: context.userId,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      old_values: (entry.oldValues ?? null) as Json | null,
      new_values: (entry.newValues ?? null) as Json | null,
    });
  } catch {
    // The audit trail must never break the business operation that triggered it.
  }
}

export { AUDIT_ACTIONS };