/**
 * Calculs de totaux du panier (purs, testables).
 *
 * Ces fonctions alimentent UNIQUEMENT l'aperçu côté client ; le serveur
 * recalcule systématiquement les totaux (RPC security-definer) et reste la
 * seule source de vérité pour la commande stockée.
 */

import type { CartLine, OrderTotals } from "./types";

export const MONEY_PRECISION = 3;

/** Arrondi monétaire 3 décimales (cohérent avec les colonnes numeric(,3)). */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function lineSubtotal(line: CartLine): number {
  return roundMoney(line.unitPrice * line.quantity);
}

/** TVA d'une ligne : qty × prix × taux% (arrondie à 3 décimales). */
export function lineTaxAmount(line: CartLine): number {
  return roundMoney(
    line.unitPrice * line.quantity * (line.taxRate / 100)
  );
}

export function subtotalOf(lines: readonly CartLine[]): number {
  return roundMoney(lines.reduce((sum, line) => sum + lineSubtotal(line), 0));
}

export function taxOf(lines: readonly CartLine[]): number {
  return roundMoney(lines.reduce((sum, line) => sum + lineTaxAmount(line), 0));
}

export function quantityOf(lines: readonly CartLine[]): number {
  return roundMoney(lines.reduce((sum, line) => sum + line.quantity, 0));
}

/** Remise plafonnée au sous-total (jamais négative). */
export function clampDiscount(subtotal: number, discount: number): number {
  if (!Number.isFinite(discount) || discount <= 0) return 0;
  return Math.min(discount, Math.max(0, subtotal));
}

export function computeOrderTotals(
  lines: readonly CartLine[],
  discountAmount: number
): OrderTotals {
  const subtotal = subtotalOf(lines);
  const taxAmount = taxOf(lines);
  const discount = clampDiscount(subtotal, discountAmount);
  return {
    quantity: quantityOf(lines),
    subtotal,
    discountAmount: roundMoney(discount),
    taxAmount,
    total: roundMoney(subtotal - discount + taxAmount),
  };
}