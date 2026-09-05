"use client";

import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: ReactNode;
  accessor: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
  className?: string;
  headerClassName?: string;
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  selectable?: boolean;
  onSelectionChange?: (keys: string[]) => void;
  onRowClick?: (row: T) => void;
  emptyState?: ReactNode;
  striped?: boolean;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  selectable = false,
  onSelectionChange,
  onRowClick,
  emptyState,
  striped = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<string[]>([]);
  const t = useTranslations("common");

  const sorted = (() => {
    if (!sortKey) return data;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return data;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (typeof va === "number" && typeof vb === "number")
        return (va - vb) * dir;
      return String(va).localeCompare(String(vb)) * dir;
    });
  })();

  const allSelected = data.length > 0 && selected.length === data.length;

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function toggleRow(key: string) {
    setSelected((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      onSelectionChange?.(next);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? [] : data.map(rowKey));
    onSelectionChange?.(allSelected ? [] : data.map(rowKey));
  }

  // Desktop table
  const table = (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]">
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="size-4 accent-[var(--color-primary)]"
                    aria-label={t("table.selectAll")}
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]",
                    col.headerClassName
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="inline-flex items-center gap-1 hover:text-[var(--color-foreground)]"
                    >
                      {col.header}
                      {sortKey === col.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp className="size-3.5" aria-hidden />
                        ) : (
                          <ArrowDown className="size-3.5" aria-hidden />
                        )
                      ) : (
                        <ArrowUpDown
                          className="size-3.5 opacity-40"
                          aria-hidden
                        />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="p-4"
                >
                  {emptyState ?? (
                    <div className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
                      {t("table.noData")}
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const key = rowKey(row);
                const isSelected = selected.includes(key);
                return (
                  <tr
                    key={key}
                    onClick={() => {
                      onRowClick?.(row);
                    }}
                    className={cn(
                      "border-b border-[var(--color-border)] transition-colors last:border-0 hover:bg-[var(--color-muted)]/60",
                      onRowClick && "cursor-pointer",
                      isSelected && "bg-[var(--color-primary)]/5",
                      striped && "odd:bg-[var(--color-muted)]/40"
                    )}
                  >
                    {selectable && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(key)}
                          onClick={(e) => e.stopPropagation()}
                          className="size-4 accent-[var(--color-primary)]"
                          aria-label={t("table.selectRow")}
                        />
                      </td>
                    )}
                    {columns.map((col) =>
                      col.hideOnMobile ? null : (
                        <td
                          key={col.key}
                          className={cn(
                            "px-4 py-3 align-middle",
                            col.className
                          )}
                        >
                          {col.accessor(row)}
                        </td>
                      )
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return <div>{table}</div>;
}
