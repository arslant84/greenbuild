import { useSyncExternalStore } from "react";

// useHydrated is false while the server renders and the browser hydrates, then true: for what must wait
// for the browser (its zone list and clock, or controls that only work with JavaScript).
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}
