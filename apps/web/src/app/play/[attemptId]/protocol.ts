import { z } from "zod";

// The engine's /attach protocol (apps/sandbox-engine/internal/attach): keystrokes and output
// travel as binary frames, control messages as JSON text frames.

export interface TerminalSize {
  rows: number;
  cols: number;
}

export type ControlMessage = { type: "exit"; code: number };

const controlSchema = z.object({ type: z.literal("exit"), code: z.number().int() });

// attachUrl puts the token and the first size in the query, as the engine reads them before upgrading.
export function attachUrl(base: string, token: string, size: TerminalSize): string {
  const url = new URL(base);
  url.searchParams.set("token", token);
  url.searchParams.set("rows", String(size.rows));
  url.searchParams.set("cols", String(size.cols));
  return url.toString();
}

export function resizeMessage(size: TerminalSize): string {
  return JSON.stringify({ type: "resize", rows: size.rows, cols: size.cols });
}

// parseControl returns null for anything the engine does not send, so a bad frame is ignored.
export function parseControl(frame: string): ControlMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(frame);
  } catch {
    return null;
  }
  const result = controlSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
