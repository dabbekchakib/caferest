"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { POS_DISPLAY_TYPES } from "@/lib/pos/config";
import type { SaleType } from "@/lib/pos/types";

interface PosHeaderProps {
  saleType: SaleType;
  onSaleTypeChange: (type: SaleType) => void;
  tableNumber: string | null;
  customerName: string | null;
  notes: string;
  linesCount: number;
  linesTotal: number;
  onOpenTables: () => void;
  onOpenCustomers: () => void;
  onNotesChange: (notes: string) => void;
}

export function PosHeader({
  saleType,
  onSaleTypeChange,
  tableNumber,
  customerName,
  notes,
  linesCount,
  linesTotal,
  onOpenTables,
  onOpenCustomers,
  onNotesChange,
}: PosHeaderProps) {
  const t = useTranslations("pos");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {POS_DISPLAY_TYPES.map((type) => (
          <Button
            key={type}
            size="sm"
            variant={saleType === type ? "primary" : "outline"}
            onClick={() => onSaleTypeChange(type)}
          >
            {t(`saleType.${type}` as "saleType.counter")}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="muted">
          {t("itemsCount", { count: linesCount })} ·{" "}
          {t("linesTotal", { total: formatTotal(linesTotal) })}
        </Badge>
        <Button variant="outline" size="md" onClick={onOpenTables}>
          {tableNumber ? t("tableLabel", { table: tableNumber }) : t("selectTable")}
        </Button>
        <Button variant="outline" size="md" onClick={onOpenCustomers}>
          {customerName ?? t("selectCustomer")}
        </Button>
      </div>

      <Input
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        placeholder={t("notesPlaceholder")}
        className="min-w-56 max-w-xs"
        aria-label={t("notesPlaceholder")}
      />
    </div>
  );
}

function formatTotal(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 3,
  }).format(value);
}