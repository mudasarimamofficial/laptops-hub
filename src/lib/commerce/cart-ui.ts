"use client";

import { useSyncExternalStore } from "react";

type CartUi = { open: boolean };

let memory: CartUi = { open: false };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function openCartDrawer() {
  memory = { open: true };
  emit();
}

export function closeCartDrawer() {
  memory = { open: false };
  emit();
}

export function useCartUi<T>(selector: (s: CartUi) => T): T {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => memory,
    () => memory,
  );
  return selector(state);
}
