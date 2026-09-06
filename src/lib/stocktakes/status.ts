// Pure stocktake workflow definition (statuses + allowed actions).
//
// The DB is the authority; this file mirrors the guards the atomic RPCs of
// supabase/migrations/00000000000052_phase_16_stocktake_rpc.sql enforce
// inside their transactions. `validate` is the ONLY stock-writing step.
import type { StocktakeStatus } from "./types";

export const STOCKTAKE_STATUSES: readonly StocktakeStatus[] = [
  "draft",
  "counting",
  "pending_review",
  "approved",
  "validated",
  "cancelled",
];

/** Header-level actions a user can trigger (each maps to an RPC + permission). */
export type StocktakeAction =
  | "start"
  | "complete"
  | "approve"
  | "validate"
  | "cancel"
  | "delete";

export const STOCKTAKE_ACTIONS: readonly StocktakeAction[] = [
  "start",
  "complete",
  "approve",
  "validate",
  "cancel",
  "delete",
];

export const STOCKTAKE_ACTION_PERMISSION: Record<StocktakeAction, string> = {
  start: "stocktakes.start",
  complete: "stocktakes.review",
  approve: "stocktakes.approve",
  validate: "stocktakes.validate",
  cancel: "stocktakes.cancel",
  delete: "stocktakes.delete",
};

/** Target status each header action moves the stocktake INTO. */
export const STOCKTAKE_ACTION_TARGET_STATUS: Record<
  StocktakeAction,
  StocktakeStatus
> = {
  start: "counting",
  complete: "pending_review",
  approve: "approved",
  validate: "validated",
  cancel: "cancelled",
  delete: "draft",
};

/**
 * Allowed transitions. `validated` (stock has moved) and `cancelled` (document
 * voided) are sinks — nothing may reopen them.
 */
export const STOCKTAKE_STATUS_ACTIONS: Record<
  StocktakeStatus,
  readonly StocktakeAction[]
> = {
  draft: ["start", "delete", "cancel"],
  counting: ["complete", "cancel"],
  pending_review: ["approve", "cancel"],
  approved: ["validate", "cancel"],
  validated: [],
  cancelled: [],
};

/** A stocktake may be edited while the counting is still open. */
export function isStocktakeEditable(status: StocktakeStatus): boolean {
  return status === "draft" || status === "counting";
}

export function stocktakeAvailableActions(
  status: StocktakeStatus
): readonly StocktakeAction[] {
  return STOCKTAKE_STATUS_ACTIONS[status] ?? [];
}

export function canStocktakeTransition(
  status: StocktakeStatus,
  action: StocktakeAction
): boolean {
  return STOCKTAKE_STATUS_ACTIONS[status]?.includes(action) ?? false;
}

export function stocktakeTargetStatus(
  status: StocktakeStatus,
  action: StocktakeAction
): StocktakeStatus | null {
  return canStocktakeTransition(status, action)
    ? STOCKTAKE_ACTION_TARGET_STATUS[action]
    : null;
}

/** Progress index used by steppers (draft 0 → validated 4). */
export const STOCKTAKE_STATUS_ORDER: Record<StocktakeStatus, number> = {
  draft: 0,
  counting: 1,
  pending_review: 2,
  approved: 3,
  validated: 4,
  cancelled: -1,
};

export const STOCKTAKE_MODES = ["standard", "blind"] as const;

export const STOCKTAKE_SCOPES = ["all", "stocked", "selected"] as const;

export function isStocktakeTerminal(status: StocktakeStatus): boolean {
  return status === "validated" || status === "cancelled";
}