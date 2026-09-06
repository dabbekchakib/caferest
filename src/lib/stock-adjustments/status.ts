// Pure stock-adjustment workflow definition (statuses + allowed actions).
//
// The DB is the authority; this file mirrors the guards the atomic RPCs of
// supabase/migrations/00000000000055_phase_17_stock_adjustment_rpc.sql enforce
// inside their transactions. `validate` is the ONLY stock-writing step.
import type { StockAdjustmentStatus, StockAdjustmentType } from "./types";

export const STOCK_ADJUSTMENT_STATUSES: readonly StockAdjustmentStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "validated",
  "cancelled",
];

/** Header-level actions a user can trigger (each maps to an RPC + permission). */
export type StockAdjustmentAction =
  | "submit"
  | "approve"
  | "validate"
  | "cancel"
  | "delete";

export const STOCK_ADJUSTMENT_ACTIONS: readonly StockAdjustmentAction[] = [
  "submit",
  "approve",
  "validate",
  "cancel",
  "delete",
];

export const STOCK_ADJUSTMENT_ACTION_PERMISSION: Record<
  StockAdjustmentAction,
  string
> = {
  submit: "stock_adjustments.submit",
  approve: "stock_adjustments.approve",
  validate: "stock_adjustments.validate",
  cancel: "stock_adjustments.cancel",
  delete: "stock_adjustments.delete",
};

/**
 * Target status each header action moves the adjustment INTO. `submit` is the
 * exception: the RPC resolves it at runtime — a submission that requires no
 * approval lands directly in `approved` (stale guard, same audit trail).
 */
export const STOCK_ADJUSTMENT_ACTION_TARGET_STATUS: Record<
  StockAdjustmentAction,
  StockAdjustmentStatus
> = {
  submit: "pending_approval",
  approve: "approved",
  validate: "validated",
  cancel: "cancelled",
  delete: "draft",
};

/** Allowed transitions. `validated` (stock has moved) and `cancelled` are sinks. */
export const STOCK_ADJUSTMENT_STATUS_ACTIONS: Record<
  StockAdjustmentStatus,
  readonly StockAdjustmentAction[]
> = {
  draft: ["submit", "cancel", "delete"],
  pending_approval: ["approve", "cancel"],
  approved: ["validate", "cancel"],
  validated: [],
  cancelled: [],
};

/** A draft may still be edited (lines added/updated/removed). */
export function isStockAdjustmentEditable(status: StockAdjustmentStatus): boolean {
  return status === "draft";
}

export function stockAdjustmentAvailableActions(
  status: StockAdjustmentStatus
): readonly StockAdjustmentAction[] {
  return STOCK_ADJUSTMENT_STATUS_ACTIONS[status] ?? [];
}

export function canStockAdjustmentTransition(
  status: StockAdjustmentStatus,
  action: StockAdjustmentAction
): boolean {
  return STOCK_ADJUSTMENT_STATUS_ACTIONS[status]?.includes(action) ?? false;
}

export function stockAdjustmentTargetStatus(
  status: StockAdjustmentStatus,
  action: StockAdjustmentAction
): StockAdjustmentStatus | null {
  return canStockAdjustmentTransition(status, action)
    ? STOCK_ADJUSTMENT_ACTION_TARGET_STATUS[action]
    : null;
}

/** Progress index used by steppers (draft 0 → validated 3). */
export const STOCK_ADJUSTMENT_STATUS_ORDER: Record<
  StockAdjustmentStatus,
  number
> = {
  draft: 0,
  pending_approval: 1,
  approved: 2,
  validated: 3,
  cancelled: -1,
};

export function isStockAdjustmentTerminal(
  status: StockAdjustmentStatus
): boolean {
  return status === "validated" || status === "cancelled";
}

/** The ten supported adjustment drivers (mirrors the migration CHECK). */
export const STOCK_ADJUSTMENT_TYPES: readonly StockAdjustmentType[] = [
  "loss",
  "breakage",
  "waste",
  "expired",
  "damaged",
  "internal_consumption",
  "sample",
  "staff_consumption",
  "cleaning",
  "other",
];