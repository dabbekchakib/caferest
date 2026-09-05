// Pure purchase-order workflow definition (statuses + transitions).
import type { PurchaseOrderStatus } from "./types";

export const PURCHASE_ORDER_STATUSES: readonly PurchaseOrderStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "sent",
  "partially_received",
  "fully_received",
  "cancelled",
  "closed",
];

/** Actions a user can trigger on an order (each maps to an RPC + permission). */
export type PurchaseOrderAction =
  | "submit"
  | "approve"
  | "send"
  | "cancel"
  | "close";

export const PURCHASE_ORDER_ACTIONS: readonly PurchaseOrderAction[] = [
  "submit",
  "approve",
  "send",
  "cancel",
  "close",
];

export const ACTION_PERMISSION: Record<PurchaseOrderAction, string> = {
  submit: "purchases.submit",
  approve: "purchases.approve",
  send: "purchases.send",
  cancel: "purchases.cancel",
  close: "purchases.close",
};

/** Target status each action moves the order INTO. */
export const ACTION_TARGET_STATUS: Record<PurchaseOrderAction, PurchaseOrderStatus> = {
  submit: "pending_approval",
  approve: "approved",
  send: "sent",
  cancel: "cancelled",
  close: "closed",
};

/**
 * Allowed transitions (source status → actions). cancelled/closed are sinks —
 * nothing may re-open them.
 */
export const STATUS_ACTIONS: Record<PurchaseOrderStatus, readonly PurchaseOrderAction[]> = {
  draft: ["submit", "cancel"],
  pending_approval: ["approve", "cancel"],
  approved: ["send", "cancel"],
  sent: ["cancel"],
  partially_received: ["cancel"],
  fully_received: ["close"],
  cancelled: [],
  closed: [],
};

/** Orders still open to edits — before they are sent to the supplier. */
export function isOrderEditable(status: PurchaseOrderStatus): boolean {
  return status === "draft" || status === "pending_approval";
}

export function availableActions(
  status: PurchaseOrderStatus
): readonly PurchaseOrderAction[] {
  return STATUS_ACTIONS[status] ?? [];
}

export function canTransition(
  status: PurchaseOrderStatus,
  action: PurchaseOrderAction
): boolean {
  return STATUS_ACTIONS[status]?.includes(action) ?? false;
}

export function targetStatus(
  status: PurchaseOrderStatus,
  action: PurchaseOrderAction
): PurchaseOrderStatus | null {
  return canTransition(status, action) ? ACTION_TARGET_STATUS[action] : null;
}