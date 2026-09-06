"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PosAreaRef, PosTableRef } from "@/lib/pos/types";

interface TablePickerProps {
  areas: PosAreaRef[];
  selectedTableId: string | null;
  selectedAreaId: string | null;
  onSelect: (tableId: string | null, areaId: string | null) => void;
}

function tableStatusVariant(status: string): "success" | "warning" | "danger" | "muted" {
  if (status === "occupied") return "danger";
  if (status === "reserved") return "warning";
  if (status === "available") return "success";
  return "muted";
}

export function TablePicker({
  areas,
  selectedTableId,
  onSelect,
}: TablePickerProps) {
  const t = useTranslations("cart");

  function selectTable(table: PosTableRef | null) {
    onSelect(table ? table.id : null, table ? table.diningAreaId : null);
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => selectTable(null)}
        className={cn(
          "w-full rounded-xl border p-3 text-start text-sm font-medium transition-colors",
          selectedTableId === null
            ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5 text-[var(--color-primary)]"
            : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        )}
      >
        {t("noTable")}
      </button>

      {areas.map((area) => (
        <div key={area.id} className="space-y-2">
          <p className="text-sm font-semibold text-[var(--color-foreground)]">
            {area.name || t("unassignedArea")}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {area.tables.map((table) => (
              <button
                key={table.id}
                type="button"
                onClick={() => selectTable(table)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-2.5 text-start transition-colors",
                  selectedTableId === table.id
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-primary)]"
                )}
              >
                <span
                  className={cn(
                    "text-sm font-bold",
                    table.status === "occupied"
                      ? "text-[var(--color-danger)]"
                      : "text-[var(--color-foreground)]"
                  )}
                >
                  {table.tableNumber}
                </span>
                <Badge variant={tableStatusVariant(table.status)} size="sm">
                  {t(`tableStatus.${table.status}` as "tableStatus.available")}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}