// Pure goods-receipt workflow definition (statuses + transitions).
//
// The DB is the authority; this file mirrors the steps the atomic RPCs
// (supabase/migrations/00000000000050_phase_15_goods_receipt_rpc.sql)
// enforce inside their transactions.
import type { GoodsReceiptStatus } from "./types";

export const GOODS_RECEIPT_STATUSES: readonly GoodsReceiptStatus[] = [
  "draft",
  "pending_validation",
  "validated",
  "cancelled",
];

/** Actions a user can trigger on a receipt (each maps to an RPC + permission). */
export type GoodsReceiptAction =
  | "submit"
  | "validate"
  | "cancel"
  | "delete";

export const GOODS_RECEIPT_ACTIONS: readonly GoodsReceiptAction[] = [
  "submit",
  "validate",
  "cancel",
  "delete",
];

export const RECEIPT_ACTION_PERMISSION: Record<GoodsReceiptAction, string> = {
  submit: "goods_receipts.submit",
  validate: "goods_receipts.validate",
  cancel: "goods_receipts.cancel",
  delete: "goods_receipts.delete",
};

/** Target status each action moves the receipt INTO. */
export const RECEIPT_ACTION_TARGET_STATUS: Record<
  GoodsReceiptAction,
  GoodsReceiptStatus
> = {
  submit: "pending_validation",
  validate: "validated",
  cancel: "cancelled",
  delete: "draft",
};

/**
 * Allowed transitions. `validated` and `cancelled` are sinks — the stock has
 * moved (or the document is void), nothing may reopen them.
 */
export const RECEIPT_STATUS_ACTIONS: Record<
  GoodsReceiptStatus,
  readonly GoodsReceiptAction[]
> = {
  draft: ["submit", "cancel", "delete"],
  pending_validation: ["validate", "cancel"],
  validated: [],
  cancelled: [],
};

/** Receipts still open to edits — before their stock is sealed. */
export function isReceiptEditable(status: GoodsReceiptStatus): boolean {
  return status === "draft" || status === "pending_validation";
}

export function receiptAvailableActions(
  status: GoodsReceiptStatus
): readonly GoodsReceiptAction[] {
  return RECEIPT_STATUS_ACTIONS[status] ?? [];
}

export function canReceiptTransition(
  status: GoodsReceiptStatus,
  action: GoodsReceiptAction
): boolean {
  return RECEIPT_STATUS_ACTIONS[status]?.includes(action) ?? false;
}

export function receiptTargetStatus(
  status: GoodsReceiptStatus,
  action: GoodsReceiptAction
): GoodsReceiptStatus | null {
  return canReceiptTransition(status, action)
    ? RECEIPT_ACTION_TARGET_STATUS[action]
    : null;
}