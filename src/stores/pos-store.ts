"use client";

import { create } from "zustand";
import type { CartLine, PosProduct, SaleType } from "@/lib/pos/types";

function nextOperationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `op-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface PosState {
  saleType: SaleType;
  tableId: string | null;
  diningAreaId: string | null;
  customerId: string | null;
  notes: string;
  discountAmount: number;
  lines: CartLine[];
  clientOperationId: string;
  currentOrderId: string | null;
  currentOrderNumber: string | null;
  addProduct: (product: PosProduct) => void;
  changeLineQuantity: (productId: string, delta: number) => void;
  setLineQuantity: (productId: string, quantity: number) => void;
  removeLine: (productId: string) => void;
  clearCart: () => void;
  setSaleType: (saleType: SaleType) => void;
  setTable: (tableId: string | null, diningAreaId: string | null) => void;
  setCustomer: (customerId: string | null) => void;
  setNotes: (notes: string) => void;
  setDiscountAmount: (amount: number) => void;
  ensureOperationId: () => string;
  attachOrder: (orderId: string, orderNumber: string) => void;
  resetAfterOrder: () => void;
}

export const usePosStore = create<PosState>()((set, get) => ({
  saleType: "dine_in",
  tableId: null,
  diningAreaId: null,
  customerId: null,
  notes: "",
  discountAmount: 0,
  lines: [],
  clientOperationId: "",
  currentOrderId: null,
  currentOrderNumber: null,

  addProduct: (product) =>
    set((state) => {
      const existing = state.lines.find(
        (line) => line.productId === product.id
      );
      const lines = existing
        ? state.lines.map((line) =>
            line.productId === product.id
              ? { ...line, quantity: line.quantity + 1 }
              : line
          )
        : [
            ...state.lines,
            {
              productId: product.id,
              name: product.name,
              unitPrice: product.price,
              taxRate: product.taxRate,
              quantity: 1,
            },
          ];
      return { lines };
    }),

  changeLineQuantity: (productId, delta) =>
    set((state) => ({
      lines: state.lines
        .map((line) =>
          line.productId === productId
            ? { ...line, quantity: Math.max(0, line.quantity + delta) }
            : line
        )
        .filter((line) => line.quantity > 0),
    })),

  setLineQuantity: (productId, quantity) =>
    set((state) => ({
      lines: state.lines
        .map((line) =>
          line.productId === productId
            ? { ...line, quantity: Math.max(1, Math.floor(quantity)) }
            : line
        )
        .filter((line) => line.quantity > 0),
    })),

  removeLine: (productId) =>
    set((state) => ({
      lines: state.lines.filter((line) => line.productId !== productId),
    })),

  clearCart: () => set({ lines: [] }),

  setSaleType: (saleType) => set({ saleType }),
  setTable: (tableId, diningAreaId) => set({ tableId, diningAreaId }),
  setCustomer: (customerId) => set({ customerId }),
  setNotes: (notes) => set({ notes }),
  setDiscountAmount: (amount) =>
    set({ discountAmount: Math.max(0, Math.round(amount * 100) / 100) }),

  ensureOperationId: () => {
    const current = get().clientOperationId;
    if (current) return current;
    const next = nextOperationId();
    set({ clientOperationId: next });
    return next;
  },

  attachOrder: (orderId, orderNumber) =>
    set({ currentOrderId: orderId, currentOrderNumber: orderNumber }),

  resetAfterOrder: () =>
    set({
      lines: [],
      notes: "",
      discountAmount: 0,
      clientOperationId: "",
      currentOrderId: null,
      currentOrderNumber: null,
    }),
}));