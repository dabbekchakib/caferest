// Pure goods-receipt quantity/cost engine (no imports outside the module so
// it runs standalone under `node --test`, mirroring src/lib/purchases).

export interface ReceiptLineAmounts {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

export interface ReceiptTotals {
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

/**
 * Line valuation for the ACCEPTED (kept) quantity:
 *
 *   gross          = accepted × unitPrice
 *   discountShare  = full line discount × accepted / ordered
 *   subtotal       = gross − discountShare
 *   taxAmount      = subtotal × taxRate/100   (taxRate is percentage points)
 *   total          = subtotal + taxAmount
 *
 * Taxes never enter the stock cost — only `subtotal` feeds unit_cost at
 * validation. Because goods_receipt_items stores the FULL order-line discount
 * (matching purchase_order_items), the accepted share of it applies here.
 */
export function calculateReceiptLineAmounts(
  orderedQuantity: number,
  acceptedQuantity: number,
  unitPrice: number,
  lineDiscountAmount: number,
  taxRate: number
): ReceiptLineAmounts {
  const ordered = Math.max(0, orderedQuantity);
  const accepted = Math.max(0, acceptedQuantity);
  const gross = accepted * Math.max(0, unitPrice);

  let discountShare = 0;
  if (ordered > 0) {
    discountShare = (Math.max(0, lineDiscountAmount) * accepted) / ordered;
  }
  if (discountShare > gross) discountShare = gross;

  const subtotal = round6(gross - discountShare);
  const taxAmount = round6((subtotal * Math.max(0, taxRate)) / 100);
  return {
    subtotal,
    discountAmount: round6(discountShare),
    taxAmount,
    total: round6(subtotal + taxAmount),
  };
}

export function calculateReceiptTotals(
  lines: ReceiptLineAmounts[]
): ReceiptTotals {
  const subtotal = round6(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const discountAmount = round6(
    lines.reduce((sum, line) => sum + line.discountAmount, 0)
  );
  const taxAmount = round6(lines.reduce((sum, line) => sum + line.taxAmount, 0));
  return {
    subtotal,
    discountAmount,
    taxAmount,
    total: round6(subtotal + taxAmount),
  };
}

/**
 * Split rule: rejected quantities are the received ones that were not kept.
 *   accepted + rejected ≤ received
 */
export function isSplitValid(
  received: number,
  accepted: number,
  rejected: number
): boolean {
  if (received < 0 || accepted < 0 || rejected < 0) return false;
  return accepted + rejected <= received;
}

/**
 * Over-receipt guard (no tolerance yet — a later phase may introduce
 * allow_over_receipt / over_receipt_tolerance_percentage).
 * Always reached against LIVE values: previously received + this receipt ≤ ordered.
 */
export function isOverReceipt(
  previouslyReceived: number,
  received: number,
  ordered: number
): boolean {
  return previouslyReceived + received > ordered;
}

/** Unit-cost basis used by the stock valuation at validation time. */
export function calculateUnitCost(netAmount: number, baseQuantity: number): number {
  if (baseQuantity <= 0) return 0;
  return round6(netAmount / baseQuantity);
}

/** Weighted-average cost after adding `incomingQty` at `incomingCost`. */
export function calculateAverageCost(
  currentQty: number,
  currentAvgCost: number,
  incomingQty: number,
  incomingCost: number
): number {
  const total = currentQty + incomingQty;
  if (total <= 0) return 0;
  return round6(
    (currentQty * currentAvgCost + incomingQty * incomingCost) / total
  );
}

const MONEY_STEP = 1e-6;

function round6(value: number): number {
  return Math.round(value / MONEY_STEP) * MONEY_STEP;
}