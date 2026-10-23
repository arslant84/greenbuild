"use client";

import { useEffect } from "react";

// useSubmitShortcut runs action on Cmd+Enter (macOS) or Ctrl+Enter, the shortcut the Figma buttons show.
export function useSubmitShortcut(action: () => void, enabled: boolean): void {
  useModifierShortcut((event) => event.key === "Enter", action, enabled);
}

// useHintShortcut runs action on Cmd+H or Ctrl+H (task 35c), but not inside the terminal: there Ctrl+H is
// the backspace the shell expects, and a hint costs XP, so it must never open by accident.
export function useHintShortcut(action: () => void, enabled: boolean): void {
  useModifierShortcut((event) => event.key.toLowerCase() === "h" && !insideTerminal(event.target), action, enabled);
}

function useModifierShortcut(matches: (event: KeyboardEvent) => boolean, action: () => void, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) {
      return undefined;
    }
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && matches(event)) {
        event.preventDefault();
        action();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [matches, action, enabled]);
}

function insideTerminal(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(".xterm") !== null;
}
