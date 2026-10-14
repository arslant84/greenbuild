import type { DiscoveryRequest, DiscoveryResponse, ErrorResponse } from "@greenbuild/shared";

// The settings screen's Open to Offers section (Figma 7:10273, task 47b). The frame has one switch: on is the
// open mode, off is hidden; passive has no control (owner, 2026-10-14) and counts as findable.

export function isFindable(discovery: Pick<DiscoveryResponse, "mode">): boolean {
  return discovery.mode !== "hidden";
}

// discoveryRequest is the PUT body for the switch; confirm_18 goes along only when the player ticked it.
export function discoveryRequest(on: boolean, confirmed18: boolean): DiscoveryRequest {
  if (!on) {
    return { mode: "hidden" };
  }
  return confirmed18 ? { mode: "open", confirm_18: true } : { mode: "open" };
}

// statusLabel is the frame's badge under "Candidate Discovery Protocol".
export function statusLabel(findable: boolean): string {
  return findable ? "ACTIVE: VISIBLE TO VERIFIED COMPANIES" : "CURRENT STATUS: INVISIBLE TO RECRUITERS";
}

// discoveryError says why the switch did not move, from the API's error code.
export function discoveryError(error: Pick<ErrorResponse, "code"> | null): string {
  if (error?.code === "unprocessable") {
    return "Confirm you are 18 or older to be found by companies.";
  }
  return "Your choice was not saved. Try again.";
}
