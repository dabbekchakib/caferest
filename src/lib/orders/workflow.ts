/**
 * Machine d'état canonique des commandes (purs, testables).
 *
 * Source unique de vérité pour le cycle de vie :
 *   draft → open | confirmed
 *   open  → confirmed | cancelled
 *   confirmed → open (attente) | preparing (en cuisine) | cancelled
 *   preparing → ready | cancelled
 *   ready  → served
 *   served → completed
 *   completed / cancelled : terminaux ; pending : réservé (vente directe).
 *
 * La migration `058_phase_20_order_workflow.sql` applique la même machine côté
 * PostgreSQL (`transition_pos_order`) ; toute divergence est un bug.
 */

import type { PosOrderStatus } from "../pos/types";

/** Ordre d'affichage stable des statuts (listes, filtres, timeline). */
export const ORDER_STATUS_ORDER: readonly PosOrderStatus[] = [
  "draft",
  "open",
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "served",
  "completed",
  "cancelled",
];

/** Tous les statuts (miroir exact du CHECK orders_status_check). */
export const ALL_ORDER_STATUSES: readonly PosOrderStatus[] = ORDER_STATUS_ORDER;

/** Transitions autorisées (même graphe que transition_pos_order). */
export const ORDER_WORKFLOW: Record<
  PosOrderStatus,
  readonly PosOrderStatus[]
> = {
  draft: ["open", "confirmed"],
  open: ["confirmed", "cancelled"],
  pending: [],
  confirmed: ["open", "preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["served"],
  served: ["completed"],
  completed: [],
  cancelled: [],
};

/** Commandes « en cours » d'un établissement (liste + panneau POS). */
export const ORDER_OPEN_STATUSES: readonly PosOrderStatus[] = [
  "open",
  "confirmed",
  "preparing",
  "ready",
  "served",
];

/**
 * Commandes dont les lignes restent modifiables (ajout / quantité / retrait).
 * Miroir de la garde `order_edit_allowed` de `update_pos_order_items`.
 */
export const ORDER_EDITABLE_STATUSES: readonly PosOrderStatus[] = [
  "draft",
  "open",
];

/** Statuts dont l'annulation est autorisée (gardé par orders.cancel). */
export const ORDER_CANCELLABLE_STATUSES: readonly PosOrderStatus[] = [
  "draft",
  "open",
  "confirmed",
  "preparing",
];

export function canTransition(
  from: PosOrderStatus,
  to: PosOrderStatus
): boolean {
  return ORDER_WORKFLOW[from].includes(to);
}

export function isOpenStatus(status: PosOrderStatus): boolean {
  return ORDER_OPEN_STATUSES.includes(status);
}

export function isEditableStatus(status: PosOrderStatus): boolean {
  return ORDER_EDITABLE_STATUSES.includes(status);
}

export function isCancellableStatus(status: PosOrderStatus): boolean {
  return ORDER_CANCELLABLE_STATUSES.includes(status);
}

/** Statut « affiché » (draft masquée dans les listes si non voulue). */
export function isOrderStatus(value: unknown): value is PosOrderStatus {
  return (
    typeof value === "string" &&
    (ALL_ORDER_STATUSES as readonly string[]).includes(value)
  );
}