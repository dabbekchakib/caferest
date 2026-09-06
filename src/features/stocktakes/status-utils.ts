import type { StocktakeStatus } from "@/lib/stocktakes/types";
import type { StatusVariant } from "@/components/shared/status-badge";

/** Maps a DB status to its stocktakeStatus i18n key. */
export const STOCKTAKE_STATUS_LABEL_KEYS: Record<StocktakeStatus, string> = {
  draft: "draft",
  counting: "counting",
  pending_review: "pendingReview",
  approved: "approved",
  validated: "validated",
  cancelled: "cancelled",
};

/** Visual tone for a stocktake status badge. */
export function stocktakeStatusTone(status: StocktakeStatus): StatusVariant {
  switch (status) {
    case "draft":
      return "muted";
    case "counting":
      return "info";
    case "pending_review":
      return "warning";
    case "approved":
      return "success";
    case "validated":
      return "success";
    case "cancelled":
      return "danger";
  }
}