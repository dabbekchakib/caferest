/**
 * Définition des permissions liées aux actions de commande (pur, testable).
 *
 * Reflète la garde serveur de `transition_pos_order`,
 * `merge_pos_orders` et `split_pos_order` : l'annulation exige `orders.cancel`,
 * toutes les autres transitions (y compris à `completed`) exigent `orders.update`.
 */

import type { PosOrderStatus } from "../pos/types";

/** Permission requise pour atteindre un statut donné. */
export const ORDER_TARGET_PERMISSIONS: Readonly<Record<PosOrderStatus, string>> =
  {
    draft: "orders.update",
    open: "orders.update",
    pending: "orders.update",
    confirmed: "orders.update",
    preparing: "orders.update",
    ready: "orders.update",
    served: "orders.update",
    completed: "orders.update",
    cancelled: "orders.cancel",
  };

export function permissionForTargetStatus(to: PosOrderStatus): string {
  return ORDER_TARGET_PERMISSIONS[to];
}

/** Actions d'écriture du module commandes (merge / split / update). */
export const ORDER_WRITE_PERMISSIONS = {
  updateItems: "orders.update",
  updateDetails: "orders.update",
  merge: "orders.update",
  split: "orders.update",
} as const;