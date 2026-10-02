"use client";

import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef } from "react";
import type { ConnectionStatus, TerminalSize } from "../protocol";
import { connectTerminal } from "../terminal-session";

interface SandboxTerminalProps {
  attachUrl: string;
  token: string;
  onStatus: (status: ConnectionStatus) => void;
  onSize: (size: TerminalSize) => void;
}

// Figma › Terminal Screen Buffer: the live shell, 20 px inside the pane.
export function SandboxTerminal({ attachUrl, token, onStatus, onSize }: SandboxTerminalProps) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) {
      return undefined;
    }
    // The cleanup may run before the terminal is ready (React strict mode mounts twice).
    let disconnect: (() => void) | undefined;
    let cancelled = false;
    onStatus("connecting");
    void connectTerminal(element, { attachUrl, token, onStatus, onSize }).then((end) => {
      if (cancelled) {
        end();
        return;
      }
      disconnect = end;
    });
    return () => {
      cancelled = true;
      disconnect?.();
    };
  }, [attachUrl, token, onStatus, onSize]);
  return (
    <div className="min-h-0 flex-1 bg-canvas p-5">
      <div ref={container} className="size-full" />
    </div>
  );
}
