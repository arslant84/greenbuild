import { XP_HINT_PENALTY } from "@greenbuild/shared";

const PERCENT = 100;

// What one hint takes off the solve's XP, as the screen states it (task 35c).
export const HINT_PENALTY_PERCENT = Math.round(XP_HINT_PENALTY * PERCENT);

// One piece of a hint's text: plain, or code that hints.md wraps in backticks.
export interface HintPart {
  text: string;
  code: boolean;
}

// hintParts splits a hint at its backticks; with an unmatched backtick the whole hint stays plain text.
export function hintParts(hint: string): HintPart[] {
  const pieces = hint.split("`");
  if (pieces.length % 2 === 0) {
    return [{ text: hint, code: false }];
  }
  return pieces.map((text, index) => ({ text, code: index % 2 === 1 })).filter((part) => part.text !== "");
}

// xpPenaltyPercent is how much of this solve's XP the opened hints take; it never passes 100.
export function xpPenaltyPercent(hintsUsed: number): number {
  return Math.min(PERCENT, HINT_PENALTY_PERCENT * hintsUsed);
}
