"use client";

import { useSyncExternalStore } from "react";

/** V5 toast (`toast(msg)`): one message at a time, cleared after 2.6s. */
let message = "";
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(msg: string) {
  message = msg;
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => {
    message = "";
    emit();
  }, 2600);
}

export function useToast() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => message,
    () => "",
  );
}
