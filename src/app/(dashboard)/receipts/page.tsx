import type { Metadata } from "next";
import {
  requirePagePermission,
  requireCurrentEstablishment,
  hasPermission,
} from "@/services/authorization";
import { getGoodsReceiptsPage } from "@/services/receiving-service";
import { GoodsReceiptList } from "@/features/receiving/goods-receipt-list";
import { getDefaultCurrencyCode } from "@/features/purchases/default-currency";
import { GOODS_RECEIPT_STATUSES } from "@/lib/receiving/status";
import type { GoodsReceiptStatus } from "@/lib/receiving/types";

export const metadata: Metadata = {
  title: "Goods receipts",
};

const VALID_STATUSES = new Set<string>(GOODS_RECEIPT_STATUSES);

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    status?: string;
    from?: string;
    to?: string;
    page?: string;
  }>;
}) {
  await requirePagePermission("goods_receipts.view");
  const establishmentId = await requireCurrentEstablishment();

  const sp = await searchParams;
  const status = VALID_STATUSES.has(sp.status ?? "")
    ? (sp.status as GoodsReceiptStatus)
    : null;
  const fromDate = sp.from?.trim() || null;
  const toDate = sp.to?.trim() || null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const [result, canCreate, canUpdate, canDelete, currency] = await Promise.all([
    getGoodsReceiptsPage(establishmentId, {
      page,
      query: sp.q ?? null,
      status,
      fromDate,
      toDate,
    }),
    hasPermission("goods_receipts.create"),
    hasPermission("goods_receipts.update"),
    hasPermission("goods_receipts.delete"),
    getDefaultCurrencyCode(establishmentId),
  ]);

  return (
    <GoodsReceiptList
      result={result}
      query={sp.q ?? ""}
      status={status ?? "all"}
      fromDate={fromDate ?? ""}
      toDate={toDate ?? ""}
      canCreate={canCreate}
      canUpdate={canUpdate}
      canDelete={canDelete}
      currency={currency}
    />
  );
}