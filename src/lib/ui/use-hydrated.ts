import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** False during server render and before hydration; true once client handlers are attached. */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}
