"use client";

import { useSyncExternalStore } from "react";

/** True while the homepage product story covers the compare-tray zone (V5 `storyIn`). */
let storyIn = false;
const listeners = new Set<() => void>();

export function setStoryInView(v: boolean) {
  if (v === storyIn) return;
  storyIn = v;
  listeners.forEach((l) => l());
}

export function useStoryInView() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => storyIn,
    () => false,
  );
}
