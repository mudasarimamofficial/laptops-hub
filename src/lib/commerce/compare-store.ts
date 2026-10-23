"use client";

import { useSyncExternalStore } from "react";

const KEY = "lh-compare-v1";
const MAX = 4;

type State = { handles: string[] };

let memory: State = { handles: [] };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function read(): State {
  if (typeof window === "undefined") return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) memory = JSON.parse(raw) as State;
  } catch {
    /* ignore */
  }
  return memory;
}

function write(next: State) {
  memory = { handles: next.handles.slice(0, MAX) };
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(memory));
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
