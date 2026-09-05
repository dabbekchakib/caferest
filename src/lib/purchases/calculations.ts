// Pure money engine for purchase orders (no imports outside the module so it
// runs standalone under `node --test`).
import type {
  LineDiscountType,
  PurchaseOrderLineInput,
  PurchaseOrderLineTotals,
  PurchaseOrderTotals,
} from "./types";

export interface CalculateLineTotalsParams {
  quantity: number;
  unitPrice: number;
  discountType: LineDiscountType;
  discountValue: number;
  taxRate: number;
}

/** Smallest money step we keep — absorbs float noise from tax/percent math. */
const MONEY_STEP = 1e-6;

function round6(value: number): number {
  return Math.round(value / MONEY_STEP) * MONEY_STEP;
}

/**
 * Line totals:
 *
 *   gross           = quantity × unitPrice
 *   discountAmount  = percentage → gross × value/100 · fixed → value
 *   subtotal        = gross − discountAmount
 *   taxAmount       = subtotal × taxRate/100  (taxRate is percentage points)
 *   total           = subtotal + taxAmount
 *
 * The discount is never allowed to exceed the gross (validation enforces it
 * upstream and the DB CHECK re-enforces it: `discount_amount >= 0`).
 */
export function calculateLineTotals(
  params: CalculateLineTotalsParams
): PurchaseOrderLineTotals {
  const gross = params.quantity * params.unitPrice;

  let discountAmount = 0;
  if (params.discountType === "percentage") {
    discountAmount = (gross * params.discountValue) / 100;
  } else if (params.discountType === "fixed") {
    discountAmount = params.discountValue;
  }
  if (discountAmount > gross) discountAmount = gross;

  const subtotal = round6(gross - discountAmount);
  const taxAmount = round6((subtotal * params.taxRate) / 100);
  return {
    subtotal,
    discountAmount: round6(discountAmount),
    taxAmount,
    total: round6(subtotal + taxAmount),
  };
}

/**
 * Order totals from its lines + order-level charges.
 *
 *   subtotal = Σ line subtotal
 *   discount = Σ line discount
 *   tax      = Σ line tax
 *   total    = subtotal + tax + shipping + other charges
 *
 * Shipping and other charges are NEVER apportioned over the ingredient lines
 * in this phase — they are order-level only.
 */
export function calculateOrderTotals(
  lines: Pick<PurchaseOrderLineTotals, "subtotal" | "discountAmount" | "taxAmount" | "total">[],
  shippingAmount: number,
  otherCharges: number
): PurchaseOrderTotals {
  const subtotal = round6(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const discountAmount = round6(
    lines.reduce((sum, line) => sum + line.discountAmount, 0)
  );
  const taxAmount = round6(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  const shipping = round6(shippingAmount);
  const other = round6(otherCharges);
  return {
    subtotal,
    discountAmount,
    taxAmount,
    shippingAmount: shipping,
    otherCharges: other,
    total: round6(subtotal + taxAmount + shipping + other),
  };
}

/**
 * Convenience: totals for a full line input (used by the create/edit actions
 * to recompute everything server-side before hitting the atomic RPC).
 */
export function calculateLineFromInput(
  line: PurchaseOrderLineInput
): PurchaseOrderLineTotals {
  return calculateLineTotals({
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountType: line.discountType,
    discountValue: line.discountValue,
    taxRate: line.taxRate,
  });
}