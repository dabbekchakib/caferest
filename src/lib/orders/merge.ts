/**
 * Politique de fusion de deux commandes (pur, testable).
 *
 * Règles serveur (`merge_pos_orders`) :
 *   - les deux commandes doivent être draft / open ;
 *   - les lignes sont déplacées de la source vers la cible ;
 *   - la remise résultante = somme des remises, plafonnée au sous-total ;
 *   - la source est annulée avec le motif `order_merged`.
 */

export interface MergeStatusPolicy {
  sourceStatus: string;
  targetStatus: string;
}

export interface MergeDiscountPolicy {
  sourceDiscount: number;
  targetDiscount: number;
  targetSubtotal: number;
}

/** Une fusion n'est légitime que si les deux commandes sont ouvertes. */
export function canMergeOrders(input: MergeStatusPolicy): boolean {
  return (
    (input.sourceStatus === "draft" || input.sourceStatus === "open") &&
    (input.targetStatus === "draft" || input.targetStatus === "open")
  );
}

/**
 * Remise agrégée après fusion : somme des deux remises, bornée à [0, subtotal].
 */
export function mergedDiscountAmount(input: MergeDiscountPolicy): number {
  const sum = input.sourceDiscount + input.targetDiscount;
  if (sum <= 0) return 0;
  if (input.targetSubtotal <= 0) return 0;
  return Math.min(sum, input.targetSubtotal);
}

/** Aucune fusion « réflexive » (source = cible) n'est admise. */
export function canMergeDistinctOrders(sourceOrderId: string, targetOrderId: string): boolean {
  return sourceOrderId !== targetOrderId;
}