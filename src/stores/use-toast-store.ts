"use client";

import { create } from "zustand";

export type ToastVariant = "info" | "success" | "warning" | "danger";

export interface Toast {
  id: string;
  title?: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  add: (toast: Omit<Toast, "id">, duration?: number) => void;
  dismiss: (id: string) => void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  add: (toast, duration = 4000) => {
    const id = `toast-${Date.now()}-${counter++}`;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    if (duration > 0) {
      setTimeout(() => get().dismiss(id), duration);
    }
  },
  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

export function useToast() {
  const add = useToastStore((state) => state.add);
  return {
    toast: add,
    info: (t: Omit<Toast, "variant" | "id">, d?: number) =>
      add({ ...t, variant: "info" }, d),
    success: (t: Omit<Toast, "variant" | "id">, d?: number) =>
      add({ ...t, variant: "success" }, d),
    warning: (t: Omit<Toast, "variant" | "id">, d?: number) =>
      add({ ...t, variant: "warning" }, d),
    error: (t: Omit<Toast, "variant" | "id">, d?: number) =>
      add({ ...t, variant: "danger" }, d),
  };
}
