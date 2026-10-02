import type { ITheme, Terminal } from "@xterm/xterm";
import { attachUrl, type ConnectionStatus, parseControl, resizeMessage, type TerminalSize } from "./protocol";

export interface TerminalSessionOptions {
  attachUrl: string;
  token: string;
  onStatus: (status: ConnectionStatus) => void;
  onSize: (size: TerminalSize) => void;
  // Keystrokes are dropped while this returns true, e.g. while the checker runs.
  isInputLocked: () => boolean;
}

// Colors and type from the Figma sandbox frames (terminal buffer, prompt green, cyan cursor).
const FONT_SIZE = 13;
const LINE_HEIGHT_PX = 21;
const THEME: ITheme = {
  background: "#0e0e0f",
  foreground: "#e5e2e3",
  cursor: "#22d3ee",
  cursorAccent: "#0e0e0f",
  selectionBackground: "#22d3ee40",
  black: "#1c1b1c",
  red: "#ffb4ab",
  green: "#64f88a",
  yellow: "#ffc640",
  blue: "#8aebff",
  cyan: "#8aebff",
  white: "#e5e2e3",
  brightBlack: "#859397",
};

// connectTerminal shows the sandbox shell in element and returns a function that ends the session.
// xterm needs the DOM, so it is loaded here, in the browser, and never during server rendering.
export async function connectTerminal(element: HTMLElement, options: TerminalSessionOptions): Promise<() => void> {
  const { terminal, fit } = await openTerminal(element);
  options.onSize({ rows: terminal.rows, cols: terminal.cols });

  const socket = new WebSocket(attachUrl(options.attachUrl, options.token, { rows: terminal.rows, cols: terminal.cols }));
  socket.binaryType = "arraybuffer";
  let exited = false;
  socket.onopen = () => options.onStatus("connected");
  socket.onclose = () => options.onStatus(exited ? "exited" : "disconnected");
  socket.onmessage = (event: MessageEvent<ArrayBuffer | string>) => {
    exited = showFrame(terminal, event.data) || exited;
  };

  const encoder = new TextEncoder();
  const input = terminal.onData((keys) => {
    if (!options.isInputLocked()) {
      sendWhenOpen(socket, encoder.encode(keys));
    }
  });
  const resize = terminal.onResize((size) => {
    options.onSize(size);
    sendWhenOpen(socket, resizeMessage(size));
  });
  const observer = new ResizeObserver(() => fit.fit());
  observer.observe(element);
  terminal.focus();

  return () => {
    observer.disconnect();
    input.dispose();
    resize.dispose();
    socket.close();
    terminal.dispose();
  };
}

// openTerminal loads xterm in the browser and fits it to element.
async function openTerminal(element: HTMLElement) {
  const [{ Terminal }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
  const terminal = new Terminal({
    cursorBlink: true,
    cursorStyle: "block",
    fontFamily: '"JetBrains Mono Variable", ui-monospace, monospace',
    fontSize: FONT_SIZE,
    lineHeight: LINE_HEIGHT_PX / FONT_SIZE,
    theme: THEME,
  });
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(element);
  fit.fit();
  return { terminal, fit };
}

// showFrame writes output and reports whether the frame said the shell exited.
function showFrame(terminal: Terminal, frame: ArrayBuffer | string): boolean {
  if (frame instanceof ArrayBuffer) {
    terminal.write(new Uint8Array(frame));
    return false;
  }
  const control = parseControl(frame);
  if (control?.type !== "exit") {
    return false;
  }
  terminal.writeln(`\r\n[shell exited with code ${control.code}]`);
  return true;
}

function sendWhenOpen(socket: WebSocket, frame: Uint8Array<ArrayBuffer> | string): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(frame);
  }
}
