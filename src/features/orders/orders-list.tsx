"use client";

import { useCallback, useState, type MouseEvent } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchBar } from "@/components/shared/search-bar";
import { FilterBar } from "@/components/shared/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Pagination } from "@/components/shared/pagination";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/format";
import { ORDER_STATUS_ORDER } from "@/lib/orders/workflow";
import type { PosOrderListResult, PosOrderStatus, SaleType } from "@/lib/pos/types";

interface OrdersListProps {
  result: PosOrderListResult;
  initialQuery: string;
  initialStatus: string;
  initialType: string;
}

const SALE_TYPES: readonly SaleType[] = [
  "dine_in",
  "takeaway",
  "delivery",
  "counter",
];

function badgeVariant(status: PosOrderStatus) {
  switch (status) {
    case "open":
      return "warning";
    case "confirmed":
      return "info";
    case "preparing":
      return "warning";
    case "ready":
    case "served":
      return "success";
    case "completed":
      return "primary";
    case "cancelled":
      return "danger";
    default:
      return "muted";
  }
}

export function OrdersList({
  result,
  initialQuery,
  initialStatus,
  initialType,
}: OrdersListProps) {
  const t = useTranslations("orders");
  const router = useRouter();
  const pathname = usePathname();

  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(initialStatus);
  const [type, setType] = useState(initialType);

  const buildHref = useCallback(
    (patch: Record<string, string | null>) => {
      const current = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") current.delete(key);
        else current.set(key, value);
      }
      const qs = current.toString();
      return qs ? `${pathname}?${qs}` : pathname;
    },
    [pathname]
  );

  const apply = useCallback(
    (patch: Record<string, string | null>) => {
      router.push(buildHref(patch));
    },
    [router, buildHref]
  );

  function reset() {
    setQuery("");
    setStatus("");
    setType("");
    router.push(pathname);
  }

  return (
    <div className="space-y-4">
      <FilterBar>
        <SearchBar
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              apply({ query: query.trim() || null, page: "1" });
            }
          }}
          onClear={() => {
            setQuery("");
            apply({ query: null, page: "1" });
          }}
          placeholder={t("searchPlaceholder")}
          containerClassName="w-full sm:max-w-xs"
          aria-label={t("searchPlaceholder")}
        />
        <Select
          className="w-full sm:w-auto"
          value={status}
          onChange={(event) => {
            const value = event.target.value;
            setStatus(value);
            apply({ status: value || null, page: "1" });
          }}
          aria-label={t("allStatuses")}
        >
          <option value="">{t("allStatuses")}</option>
          {ORDER_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {t(`status${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
            </option>
          ))}
        </Select>
        <Select
          className="w-full sm:w-auto"
          value={type}
          onChange={(event) => {
            const value = event.target.value;
            setType(value);
            apply({ type: value || null, page: "1" });
          }}
          aria-label={t("allTypes")}
        >
          <option value="">{t("allTypes")}</option>
          {SALE_TYPES.map((s) => (
            <option key={s} value={s}>
              {t(`type${s.charAt(0).toUpperCase()}${s.slice(1)}`)}
            </option>
          ))}
        </Select>
        <Button variant="ghost" size="sm" onClick={reset} className="ms-auto">
          <RotateCcw className="size-4" aria-hidden />
          {t("reset")}
        </Button>
      </FilterBar>

      {result.items.length === 0 ? (
        <EmptyState title={t("noData")} />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {t("reference")}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {t("status")}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {t("orderType")}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {t("table")}
                    </th>
                    <th className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {t("items")}
                    </th>
                    <th className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      {t("total")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((order) => (
                    <tr
                      key={order.id}
                      className="cursor-pointer border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-muted)]/50"
                      onClick={() => router.push(`/orders/${order.id}`)}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/orders/${order.id}`}
                          className="font-medium text-[var(--color-primary)] hover:underline"
                          onClick={(event: MouseEvent<HTMLAnchorElement>) =>
                            event.stopPropagation()
                          }
                        >
                          {order.orderNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={badgeVariant(order.status)}>
                          {t(
                            `status${order.status.charAt(0).toUpperCase()}${order.status.slice(1)}`
                          )}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted-foreground)]">
                        {t(
                          `type${order.orderType.charAt(0).toUpperCase()}${order.orderType.slice(1)}`
                        )}
                      </td>
                      <td className="px-4 py-3">{order.tableNumber ?? "—"}</td>
                      <td className="px-4 py-3">{order.itemsCount}</td>
                      <td className="px-4 py-3 text-end font-semibold">
                        {formatCurrency(order.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Pagination
            page={result.page}
            totalPages={result.totalPages}
            totalItems={result.total}
            pageSize={result.pageSize}
            onPageChange={(page) => apply({ page: String(page) })}
          />
        </>
      )}
    </div>
  );
}
