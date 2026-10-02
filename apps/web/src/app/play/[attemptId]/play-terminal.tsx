"use client";

import "@xterm/xterm/css/xterm.css";
import { useEffect, useRef, useState } from "react";
import { connectTerminal } from "./terminal-session";

interface PlayTerminalProps {
  attachUrl: string;
  token: string;
}

export function PlayTerminal({ attachUrl, token }: PlayTerminalProps) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState("Connecting…");

  useEffect(() => {
    const element = container.current;
    if (!element) {
      return;
    }
    // The cleanup may run before the terminal is ready (React strict mode mounts twice).
    let disconnect: (() => void) | undefined;
    let cancelled = false;
    void connectTerminal(element, { attachUrl, token, onStatus: setStatus }).then((end) => {
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
  }, [attachUrl, token]);

  return (
    <section>
      <p role="status">{status}</p>
      <div ref={container} style={{ height: "70vh" }} />
    </section>
  );
}
