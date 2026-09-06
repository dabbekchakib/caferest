import type { GoodsReceiptStatus } from "@/lib/receiving/types";
import type { StatusVariant } from "@/components/shared/status-badge";

/** Maps a DB status to its receiptStatus i18n key. */
export const GOODS_RECEIPT_STATUS_LABEL_KEYS: Record<
  GoodsReceiptStatus,
  string
> = {
  draft: "draft",
  pending_validation: "pendingValidation",
  validated: "validated",
  cancelled: "cancelled",
};

/** Visual tone for a goods-receipt status badge. */
export function goodsReceiptStatusTone(
  status: GoodsReceiptStatus
): StatusVariant {
  switch (status) {
    case "draft":
      return "muted";
    case "pending_validation":
      return "warning";
    case "validated":
      return "success";
    case "cancelled":
      return "danger";
  }
}