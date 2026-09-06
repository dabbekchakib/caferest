import type { StockAdjustmentStatus } from "@/lib/stock-adjustments/types";
import type { StatusVariant } from "@/components/shared/status-badge";

/** Maps a DB status to its stockAdjustmentStatus i18n key. */
export const STOCK_ADJUSTMENT_STATUS_LABEL_KEYS: Record<
  StockAdjustmentStatus,
  string
> = {
  draft: "draft",
  pending_approval: "pendingApproval",
  approved: "approved",
  validated: "validated",
  cancelled: "cancelled",
};

/** Visual tone for an adjustment status badge. */
export function stockAdjustmentStatusTone(
  status: StockAdjustmentStatus
): StatusVariant {
  switch (status) {
    case "draft":
      return "muted";
    case "pending_approval":
      return "warning";
    case "approved":
      return "info";
    case "validated":
      return "success";
    case "cancelled":
      return "danger";
  }
}