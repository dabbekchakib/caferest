"use client";

import { useMemo, useState } from "react";
import { Barcode, Plus, SearchX } from "lucide-react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PosCatalog, PosProduct } from "@/lib/pos/types";

interface CatalogPanelProps {
  catalog: PosCatalog;
  onAdd: (product: PosProduct) => void;
}

export function CatalogPanel({ catalog, onAdd }: CatalogPanelProps) {
  const t = useTranslations("pos");
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [barcode, setBarcode] = useState("");
  const [barcodeMiss, setBarcodeMiss] = useState(false);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base =
      activeCategory === "all"
        ? catalog.products
        : catalog.products.filter(
            (product) => product.categoryId === activeCategory
          );
    if (!q) return base;
    return base.filter(
      (product) =>
        product.name.toLowerCase().includes(q) ||
        (product.barcode ?? "").toLowerCase().includes(q) ||
        (product.sku ?? "").toLowerCase().includes(q)
    );
  }, [catalog.products, activeCategory, query]);

  const categories = useMemo(() => {
    const present = new Set(
      catalog.products.map((product) => product.categoryId)
    );
    return catalog.categories.filter(
      (category) =>
        present.has(category.id) || activeCategory === category.id
    );
  }, [catalog.categories, catalog.products, activeCategory]);

  function addDirect(product: PosProduct) {
    setBarcode("");
    setBarcodeMiss(false);
    onAdd(product);
  }

  function handleBarcodeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const code = barcode.trim();
    if (!code) return;
    const match = catalog.products.find(
      (product) => product.barcode === code || product.sku === code
    );
    if (match) {
      addDirect(match);
    } else {
      setBarcodeMiss(true);
      setBarcode("");
    }
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
        />
        <div className="relative">
          <Input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={handleBarcodeKeyDown}
            placeholder={t("barcodePlaceholder")}
            aria-label={t("barcodePlaceholder")}
            className="pr-9"
          />
          <Barcode
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-[var(--color-muted-foreground)]"
            aria-hidden
          />
        </div>
        {barcodeMiss && (
          <p className="text-xs text-[var(--color-danger)]">
            {t("barcodeNotFound")}
          </p>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap">
        <button
          type="button"
          onClick={() => setActiveCategory("all")}
          className={cn(
            "h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
            activeCategory === "all"
              ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
              : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          )}
        >
          {t("all")}
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setActiveCategory(category.id)}
            className={cn(
              "h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
              activeCategory === category.id
                ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      {filteredProducts.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] py-12 text-center">
          <SearchX
            className="size-8 text-[var(--color-muted-foreground)]"
            aria-hidden
          />
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t("noResults")}
          </p>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => {
            const enabled = product.isAvailable;
            return (
              <button
                key={product.id}
                type="button"
                onClick={() => enabled && addDirect(product)}
                disabled={!enabled}
                className={cn(
                  "flex min-h-24 flex-col items-start justify-between gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-start shadow-sm transition-all",
                  enabled
                    ? "hover:border-[var(--color-primary)] hover:shadow-md active:scale-[0.98]"
                    : "cursor-not-allowed opacity-50"
                )}
              >
                <span className="flex w-full items-start justify-between gap-2">
                  <span className="line-clamp-2 text-sm font-medium text-[var(--color-foreground)]">
                    {product.name}
                  </span>
                  <Plus className="size-4 shrink-0 text-[var(--color-primary)]" aria-hidden />
                </span>
                <span className="flex w-full items-baseline justify-between gap-2">
                  <span className="text-sm font-bold text-[var(--color-primary)]">
                    {formatCurrency(product.price)}
                  </span>
                  {!enabled && (
                    <Badge variant="muted" size="sm">
                      {t("unavailable")}
                    </Badge>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}