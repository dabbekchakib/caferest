import type { PurchaseOrderStatus } from "@/lib/purchases/types";
import type { StatusVariant } from "@/components/shared/status-badge";

/** Maps a DB status to its purchaseOrderStatus i18n key. */
export const PURCHASE_ORDER_STATUS_LABEL_KEYS: Record<
  PurchaseOrderStatus,
  string
> = {
  draft: "draft",
  pending_approval: "pendingApproval",
  approved: "approved",
  sent: "sent",
  partially_received: "partiallyReceived",
  fully_received: "fullyReceived",
  cancelled: "cancelled",
  closed: "closed",
};

/** Visual tone for a purchase-order status badge. */
export function purchaseOrderStatusTone(
  status: PurchaseOrderStatus
): StatusVariant {
  switch (status) {
    case "draft":
      return "muted";
    case "pending_approval":
      return "warning";
    case "approved":
      return "info";
    case "sent":
      return "primary";
    case "partially_received":
      return "warning";
    case "fully_received":
      return "success";
    case "cancelled":
      return "danger";
    case "closed":
      return "muted";
  }
}