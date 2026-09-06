/**
 * Politique de séparation d'une commande (pur, testable).
 *
 * Règles serveur (`split_pos_order`) :
 *   - la commande source doit être draft / open ;
 *   - au moins une ligne doit être déplacée ;
 *   - seules les lignes appartenant à la source sont déplaçables (vérifiées
 *     côté serveur — l'UI ne doit jamais pouvoir déplacer une ligne étrangère) ;
 *   - la nouvelle commande hérite du statut de la source (draft / open)
 *     et d'un nouveau numéro serveur.
 */

export interface SplitOrderPolicy {
  sourceStatus: string;
  selectedItemIds: readonly string[];
  /** Identifiants de lignes réellement possédés par la source (source de vérité serveur). */
  ownedItemIds: readonly string[];
}

/** Une séparation n'est légitime que sur une commande ouverte et non vide. */
export function canSplitOrder(input: SplitOrderPolicy): boolean {
  return (
    (input.sourceStatus === "draft" || input.sourceStatus === "open") &&
    input.selectedItemIds.length >= 1
  );
}

/**
 * Lignes effectivement déplacées = intersection sélection ∩ lignes de la source.
 * Retourne des identifiants uniques, triés pour la stabilité.
 */
export function resolveSplitItemIds(input: SplitOrderPolicy): string[] {
  const owned = new Set(input.ownedItemIds);
  const selected = new Set(input.selectedItemIds);
  return [...owned].filter((id) => selected.has(id)).sort();
}

/** Au moins une ligne doit être déplacable (sinon le split échoue). */
export function hasMovableItems(input: SplitOrderPolicy): boolean {
  return resolveSplitItemIds(input).length > 0;
}