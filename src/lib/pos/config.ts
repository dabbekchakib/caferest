/**
 * Constantes de configuration du module POS (pures, testables).
 *
 * La machine d'état canonique des commandes vit dans `src/lib/orders/workflow` ;
 * ce module ne fait que réexposer les statuts et utiliser la même machine, afin
 * que POS et module commandes ne divergent jamais.
 */

import type { PosOrderStatus, SaleType } from "./types";
import { ALL_ORDER_STATUSES, ORDER_WORKFLOW } from "../orders/workflow";

/** Types de vente gérés par la base (CHECK orders_type_check). */
export const SALE_TYPES: readonly SaleType[] = [
  "dine_in",
  "takeaway",
  "delivery",
  "counter",
];

/** Types proposés à l'écran du POS (compi/front comptoir). */
export const POS_DISPLAY_TYPES: readonly SaleType[] = [
  "dine_in",
  "takeaway",
  "counter",
];

/** Statuts de commande gérés (miroir du CHECK orders_status_check). */
export const ORDER_STATUSES: readonly PosOrderStatus[] = ALL_ORDER_STATUSES;

/** Commandes affichées dans le panneau « commandes ouvertes ». */
export const OPEN_ORDER_STATUSES: readonly PosOrderStatus[] = [
  "open",
  "confirmed",
  "preparing",
  "ready",
  "served",
];

/** Clés de paramètres POS (table settings, groupe 'pos'). */
export const POS_SETTINGS_KEYS = {
  allowDiscount: "pos.allow_discount",
  requireConfirmation: "pos.require_order_confirmation",
  allowNegativeStock: "pos.allow_negative_stock",
} as const;

export const POS_SETTINGS_DEFAULTS = {
  allowDiscount: true,
  requireConfirmation: true,
  allowNegativeStock: false,
} as const;

/** Transitions de statut autorisées — miroir exact de order_workflow.sql. */
export const POS_TRANSITIONS: Record<
  PosOrderStatus,
  readonly PosOrderStatus[]
> = ORDER_WORKFLOW;

export function isSaleType(value: unknown): value is SaleType {
  return (
    typeof value === "string" &&
    (SALE_TYPES as readonly string[]).includes(value)
  );
}

export function isOrderStatus(value: unknown): value is PosOrderStatus {
  return (
    typeof value === "string" &&
    (ORDER_STATUSES as readonly string[]).includes(value)
  );
}

export function canTransition(
  from: PosOrderStatus,
  to: PosOrderStatus
): boolean {
  return POS_TRANSITIONS[from].includes(to);
}