"use client";

import { useEffect } from "react";

// useSubmitShortcut runs action on Cmd+Enter (macOS) or Ctrl+Enter, the shortcut the Figma buttons show.
export function useSubmitShortcut(action: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        action();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [action, enabled]);
}
