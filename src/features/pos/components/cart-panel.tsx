"use client";

import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { computeOrderTotals } from "@/lib/pos/calculations";
import { formatCurrency } from "@/lib/format";
import type { CartLine } from "@/lib/pos/types";

interface CartPanelProps {
  lines: CartLine[];
  discountAmount: number;
  allowDiscount: boolean;
  submitting: boolean;
  onSetDiscount: (amount: number) => void;
  onQuantity: (productId: string, delta: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
  onSubmit: () => void;
}

export function CartPanel({
  lines,
  discountAmount,
  allowDiscount,
  submitting,
  onSetDiscount,
  onQuantity,
  onRemove,
  onClear,
  onSubmit,
}: CartPanelProps) {
  const t = useTranslations("cart");
  const totals = computeOrderTotals(lines, discountAmount);

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
        <div className="flex items-center gap-2">
          <ShoppingCart
            className="size-5 text-[var(--color-muted-foreground)]"
            aria-hidden
          />
          <h2 className="font-semibold text-[var(--color-foreground)]">
            {t("title")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="muted">{t("itemCount", { count: totals.quantity })}</Badge>
          <Button variant="ghost" size="sm" onClick={onClear} disabled={lines.length === 0}>
            {t("clear")}
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-4 py-2">
        {lines.length === 0 ? (
          <div className="flex h-full min-h-32 flex-col items-center justify-center gap-2 text-center">
            <ShoppingCart
              className="size-8 text-[var(--color-muted-foreground)]"
              aria-hidden
            />
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {t("emptyHint")}
            </p>
          </div>
        ) : (
          lines.map((line) => (
            <div
              key={line.productId}
              className="flex items-center gap-3 rounded-lg p-2 hover:bg-[var(--color-muted)]/60"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--color-foreground)]">
                  {line.name}
                </p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {formatCurrency(line.unitPrice)}
                </p>
              </div>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => onQuantity(line.productId, -1)}
                aria-label={t("decrease")}
              >
                <Minus className="size-3.5" aria-hidden />
              </Button>
              <span className="w-6 text-center text-sm font-semibold text-[var(--color-foreground)]">
                {line.quantity}
              </span>
              <Button
                size="icon-sm"
                variant="outline"
                onClick={() => onQuantity(line.productId, 1)}
                aria-label={t("increase")}
              >
                <Plus className="size-3.5" aria-hidden />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={() => onRemove(line.productId)}
                aria-label={t("remove")}
              >
                <Trash2
                  className="size-3.5 text-[var(--color-danger)]"
                  aria-hidden
                />
              </Button>
            </div>
          ))
        )}
      </div>

      <div className="space-y-2 border-t border-[var(--color-border)] p-4">
        {allowDiscount && (
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="cart-discount"
              className="text-sm text-[var(--color-muted-foreground)]"
            >
              {t("discount")}
            </label>
            <Input
              id="cart-discount"
              type="number"
              min={0}
              step="0.001"
              value={discountAmount === 0 ? "" : discountAmount}
              onChange={(e) =>
                onSetDiscount(Number.parseFloat(e.target.value) || 0)
              }
              className="h-9 w-32 text-right"
              aria-label={t("discount")}
            />
          </div>
        )}
        <div className="flex justify-between text-sm text-[var(--color-muted-foreground)]">
          <span>{t("subtotal")}</span>
          <span>{formatCurrency(totals.subtotal)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm text-[var(--color-muted-foreground)]">
            <span>{t("discount")}</span>
            <span>-{formatCurrency(totals.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm text-[var(--color-muted-foreground)]">
          <span>{t("tax")}</span>
          <span>{formatCurrency(totals.taxAmount)}</span>
        </div>
        <div className="flex justify-between text-xl font-bold text-[var(--color-foreground)]">
          <span>{t("total")}</span>
          <span className="text-[var(--color-primary)]">
            {formatCurrency(totals.total)}
          </span>
        </div>
        <Button
          size="lg"
          className="mt-2 w-full"
          loading={submitting}
          disabled={lines.length === 0 || submitting}
          onClick={onSubmit}
        >
          {t("placeOrder", { total: formatCurrency(totals.total) })}
        </Button>
      </div>
    </div>
  );
}