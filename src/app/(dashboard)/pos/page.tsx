"use client";

import { useMemo, useState } from "react";
import {
  Bitcoin,
  Coffee,
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  Users,
  Wine,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchBar } from "@/components/shared/search-bar";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Product {
  id: number;
  name: string;
  price: number;
  category: string;
  icon: "coffee" | "bar";
}

interface CartLine {
  product: Product;
  qty: number;
}

type CategoryKey = "all" | "coffee" | "drinks" | "bar" | "kitchen" | "desserts";

const categories: CategoryKey[] = [
  "all",
  "coffee",
  "drinks",
  "bar",
  "kitchen",
  "desserts",
];

const products: Product[] = [
  { id: 1, name: "Espresso", price: 3.5, category: "coffee", icon: "coffee" },
  { id: 2, name: "Cappuccino", price: 5.0, category: "coffee", icon: "coffee" },
  {
    id: 3,
    name: "Café au lait",
    price: 4.5,
    category: "coffee",
    icon: "coffee",
  },
  { id: 4, name: "Mojito", price: 8.0, category: "bar", icon: "bar" },
  { id: 5, name: "Eau minérale", price: 2.0, category: "drinks", icon: "bar" },
  {
    id: 6,
    name: "Thé à la menthe",
    price: 4.0,
    category: "drinks",
    icon: "coffee",
  },
  { id: 7, name: "Coca-Cola", price: 3.5, category: "drinks", icon: "bar" },
  {
    id: 8,
    name: "Salade César",
    price: 12.0,
    category: "kitchen",
    icon: "bar",
  },
  {
    id: 9,
    name: "Burger maison",
    price: 14.5,
    category: "kitchen",
    icon: "bar",
  },
  { id: 10, name: "Tiramisu", price: 6.5, category: "desserts", icon: "bar" },
  {
    id: 11,
    name: "Fondant chocolat",
    price: 7.0,
    category: "desserts",
    icon: "bar",
  },
];

const categoryLabelKey: Record<CategoryKey, string> = {
  all: "all",
  coffee: "catCoffee",
  drinks: "catDrinks",
  bar: "catBar",
  kitchen: "catKitchen",
  desserts: "catDesserts",
};

export default function PosDemoPage() {
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [cart, setCart] = useState<CartLine[]>([]);
  const t = useTranslations("pos");
  const tCommon = useTranslations("common");

  const filtered = useMemo(
    () =>
      products.filter(
        (p) => activeCategory === "all" || p.category === activeCategory
      ),
    [activeCategory]
  );

  const total = cart.reduce(
    (sum, line) => sum + line.product.price * line.qty,
    0
  );

  function addProduct(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  }

  function changeQty(id: number, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === id ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  }

  function removeLine(id: number) {
    setCart((prev) => prev.filter((l) => l.product.id !== id));
  }

  const itemCount = cart.reduce((s, l) => s + l.qty, 0);

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col gap-4 lg:h-[calc(100vh-4rem)]">
      {/* Order header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-lg bg-[var(--color-primary)] text-xl font-bold text-[var(--color-primary-foreground)]">
            04
          </span>
          <div>
            <p className="text-lg font-semibold text-[var(--color-foreground)]">
              Table 04
            </p>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {t("customers", { count: 2 })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="md">
            <Users className="size-4" aria-hidden /> {t("change")}
          </Button>
          <Button variant="ghost" size="md">
            {t("release")}
          </Button>
        </div>
      </div>

      <div className="grid flex-1 gap-4 overflow-hidden lg:grid-cols-5">
        {/* Products panel */}
        <div className="flex min-h-0 flex-col lg:col-span-3">
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 lg:flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors",
                  activeCategory === cat
                    ? "bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                    : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                )}
              >
                {t(categoryLabelKey[cat])}
              </button>
            ))}
          </div>
          <div className="grid min-h-0 grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3 xl:grid-cols-4">
            {filtered.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product)}
                className="flex h-24 flex-col items-start justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-3 text-start shadow-sm transition-all hover:border-[var(--color-primary)] hover:shadow-md active:scale-[0.98]"
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-[var(--color-muted)] text-[var(--color-primary)]">
                  {product.icon === "coffee" ? (
                    <Coffee className="size-4" aria-hidden />
                  ) : (
                    <Wine className="size-4" aria-hidden />
                  )}
                </span>
                <div>
                  <p className="text-sm font-medium text-[var(--color-foreground)]">
                    {product.name}
                  </p>
                  <p className="text-sm font-bold text-[var(--color-primary)]">
                    {formatCurrency(product.price)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cart panel */}
        <Card className="flex min-h-0 flex-col overflow-hidden lg:col-span-2">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
            <div className="flex items-center gap-2">
              <ShoppingCart
                className="size-5 text-[var(--color-muted-foreground)]"
                aria-hidden
              />
              <h2 className="font-semibold text-[var(--color-foreground)]">
                {t("activeOrder")}
              </h2>
            </div>
            <Badge variant="muted">
              {t("itemCount", { count: itemCount })}
            </Badge>
          </div>

          <SearchBar
            placeholder={t("addItemPlaceholder")}
            containerClassName="m-4"
          />

          <div className="flex-1 space-y-1 overflow-y-auto px-4">
            {cart.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
                <ShoppingCart
                  className="size-10 text-[var(--color-muted-foreground)]"
                  aria-hidden
                />
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {t("selectProducts")}
                </p>
              </div>
            ) : (
              cart.map((line) => (
                <div
                  key={line.product.id}
                  className="flex items-center gap-3 rounded-lg p-2 hover:bg-[var(--color-muted)]/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--color-foreground)]">
                      {line.product.name}
                    </p>
                    <p className="text-xs text-[var(--color-muted-foreground)]">
                      {formatCurrency(line.product.price)}
                    </p>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    onClick={() => changeQty(line.product.id, -1)}
                    aria-label={t("decrease")}
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </Button>
                  <span className="w-6 text-center text-sm font-semibold">
                    {line.qty}
                  </span>
                  <Button
                    size="icon-sm"
                    variant="outline"
                    onClick={() => changeQty(line.product.id, 1)}
                    aria-label={t("increase")}
                  >
                    <Plus className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => removeLine(line.product.id)}
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
            <div className="flex justify-between text-sm text-[var(--color-muted-foreground)]">
              <span>{t("subtotal")}</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between text-sm text-[var(--color-muted-foreground)]">
              <span>{tCommon("common.taxRate", { rate: 19 })}</span>
              <span>{formatCurrency(total * 0.19)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-[var(--color-foreground)]">
              <span>{t("total")}</span>
              <span className="text-[var(--color-primary)]">
                {formatCurrency(total)}
              </span>
            </div>
            <Button
              size="lg"
              className="mt-2 w-full"
              disabled={cart.length === 0}
            >
              <Bitcoin className="size-5" aria-hidden /> {t("pay")}{" "}
              {cart.length > 0 ? formatCurrency(total) : ""}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
