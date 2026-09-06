/**
 * Constantes de configuration du module POS (pures, testables).
 */

import type { PosOrderStatus, SaleType } from "./types";

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

/** Statuts de commande gérés par la Phase 19. */
export const ORDER_STATUSES: readonly PosOrderStatus[] = [
  "draft",
  "open",
  "confirmed",
  "cancelled",
];

/** Commandes affichées dans le panneau « commandes ouvertes ». */
export const OPEN_ORDER_STATUSES: readonly PosOrderStatus[] = ["open", "confirmed"];

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

/** Transitions de statut autorisées (les autres sont rejetées côté serveur). */
export const POS_TRANSITIONS: Record<
  PosOrderStatus,
  readonly PosOrderStatus[]
> = {
  draft: ["confirmed"],
  open: ["confirmed", "cancelled"],
  confirmed: ["open", "cancelled"],
  cancelled: [],
};

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