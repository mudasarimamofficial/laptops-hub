"use client";

import { useSyncExternalStore } from "react";
import { showToast } from "@/lib/commerce/toast";

const KEY = "lh-compare-v1";
const MAX = 4;

type State = { handles: string[] };

let memory: State = { handles: [] };
/** Raw localStorage value behind `memory`; getSnapshot must return a stable reference while it is unchanged. */
let memoryRaw: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function read(): State {
  if (typeof window === "undefined") return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw && raw !== memoryRaw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      memory = { handles: Array.isArray(parsed.handles) ? parsed.handles.filter((h) => typeof h === "string") : [] };
      memoryRaw = raw;
    }
  } catch {
    /* ignore */
  }
  return memory;
}

function write(next: State) {
  memory = { handles: next.handles.slice(0, MAX) };
  memoryRaw = JSON.stringify(memory);
  if (typeof window !== "undefined") localStorage.setItem(KEY, memoryRaw);
  emit();
}

export function useCompare<T>(selector: (s: State & CompareActions) => T): T {
  const state = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => memory,
  );

  const actions: CompareActions = {
    toggle(handle) {
      const cur = read().handles;
      if (cur.includes(handle)) write({ handles: cur.filter((h) => h !== handle) });
      else if (cur.length < MAX) write({ handles: [...cur, handle] });
      else showToast("Compare holds up to 4 products");
    },
    remove(handle) {
      write({ handles: read().handles.filter((h) => h !== handle) });
    },
    clear() {
      write({ handles: [] });
    },
    has(handle) {
      return read().handles.includes(handle);
    },
  };

  return selector({ ...state, ...actions });
}

type CompareActions = {
  toggle: (handle: string) => void;
  remove: (handle: string) => void;
  clear: () => void;
  has: (handle: string) => boolean;
};

export const COMPARE_MAX = MAX;
