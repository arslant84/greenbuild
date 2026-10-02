import { ATTEMPT_MAX_CHECKS } from "@greenbuild/shared";
import type { ConnectionStatus } from "../protocol";
import type { ActionMode } from "./action-panel";
import type { CheckState } from "./use-check";

const TOO_MANY_REQUESTS = 429;

export interface SandboxView {
  // Which Figma state frame's elements are on screen.
  frame: "V1" | "V2" | "V3" | "V4" | "V5";
  mode: ActionMode;
  checksLeft: number;
}

// sandboxView decides the state from the connection, the last check and the checks used. A solved
// attempt stays V3; a dropped connection shows V5 over anything but a solve.
export function sandboxView(status: ConnectionStatus, check: CheckState, checksUsed: number): SandboxView {
  const checksLeft = Math.max(0, ATTEMPT_MAX_CHECKS - checksUsed);
  if (check.kind === "done" && check.result.passed) {
    return { frame: "V3", mode: "exhausted", checksLeft };
  }
  if (status === "disconnected") {
    return { frame: "V5", mode: "reconnecting", checksLeft };
  }
  if (check.kind === "checking") {
    return { frame: "V2", mode: "checking", checksLeft };
  }
  const exhausted = checksLeft === 0 || (check.kind === "error" && check.status === TOO_MANY_REQUESTS);
  const mode = exhausted || status !== "connected" ? "exhausted" : "ready";
  return { frame: check.kind === "done" ? "V4" : "V1", mode, checksLeft };
}
