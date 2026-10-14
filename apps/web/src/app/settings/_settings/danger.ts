import { EXPORT_LINK_DAYS } from "@greenbuild/shared";

// The settings' Danger Zone (Figma 7:10273, task 47b): when deletion may go ahead, and what the two modals say.

export const DELETE_WORD = "DELETE";

// deleteReady is the frame's rule for "Delete permanently": the box ticked and DELETE typed.
export function deleteReady(understood: boolean, typed: string): boolean {
  return understood && typed.trim() === DELETE_WORD;
}

// exportNote replaces the frame's "~14 minutes … 48 hours": the worker sends the link within minutes, and the
// link works for EXPORT_LINK_DAYS days.
export function exportNote(): string {
  return `The link usually arrives within a few minutes and works for ${EXPORT_LINK_DAYS} days.`;
}
