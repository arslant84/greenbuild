import type { Terminal } from "@xterm/xterm";
import { attachUrl, parseControl, resizeMessage } from "./protocol";

export interface TerminalSessionOptions {
  attachUrl: string;
  token: string;
  onStatus: (status: string) => void;
}

// connectTerminal shows the sandbox shell in element and returns a function that ends the session.
// xterm needs the DOM, so it is loaded here, in the browser, and never during server rendering.
export async function connectTerminal(element: HTMLElement, options: TerminalSessionOptions): Promise<() => void> {
  const [{ Terminal }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit")]);
  const terminal = new Terminal({ cursorBlink: true });
  const fit = new FitAddon();
  terminal.loadAddon(fit);
  terminal.open(element);
  fit.fit();

  const socket = new WebSocket(attachUrl(options.attachUrl, options.token, { rows: terminal.rows, cols: terminal.cols }));
  socket.binaryType = "arraybuffer";
  socket.onopen = () => options.onStatus("Connected");
  socket.onclose = () => options.onStatus("Disconnected");
  socket.onmessage = (event: MessageEvent<ArrayBuffer | string>) => showFrame(terminal, event.data, options.onStatus);

  const encoder = new TextEncoder();
  const input = terminal.onData((keys) => sendWhenOpen(socket, encoder.encode(keys)));
  const resize = terminal.onResize((size) => sendWhenOpen(socket, resizeMessage(size)));
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

function showFrame(terminal: Terminal, frame: ArrayBuffer | string, onStatus: (status: string) => void): void {
  if (frame instanceof ArrayBuffer) {
    terminal.write(new Uint8Array(frame));
    return;
  }
  const control = parseControl(frame);
  if (control?.type === "exit") {
    terminal.writeln(`\r\n[shell exited with code ${control.code}]`);
    onStatus(`Shell exited with code ${control.code}`);
  }
}

function sendWhenOpen(socket: WebSocket, frame: Uint8Array<ArrayBuffer> | string): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(frame);
  }
}
