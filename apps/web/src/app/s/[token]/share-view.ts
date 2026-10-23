import type { ShareCard } from "@greenbuild/shared";
import { formatClock } from "../../../ui/format";

const MS_PER_SECOND = 1_000;

// What a share card says (task 51), the same on the public page and in its image.
export interface ShareView {
  name: string;
  handle: string | null;
  title: string;
  solvedIn: string;
  xp: string;
  checks: string;
  streak: string;
  skills: string[];
  // One line for link previews and the page's description.
  summary: string;
}

// playerNames: a player without a display name shows their handle; one without either stays anonymous. The
// handle shows beside a display name only, so it never appears twice.
export function playerNames(player: { display_name: string | null; handle: string | null }): { name: string; handle: string | null } {
  const handle = player.handle ? `@${player.handle}` : null;
  return { name: player.display_name ?? handle ?? "A greenbuild player", handle: player.display_name ? handle : null };
}

// shareView: XP is "—" until the worker credits the solve.
export function shareView(card: ShareCard): ShareView {
  const { name, handle } = playerNames(card);
  const time = card.duration_ms === null ? null : formatClock(card.duration_ms / MS_PER_SECOND);
  return {
    name,
    handle,
    title: card.challenge_title,
    solvedIn: time ? `Solved in ${time}` : "Solved",
    xp: card.xp_earned === null ? "— XP" : `+${card.xp_earned} XP`,
    checks: `${card.checks_passed}/${card.checks_used} checks passed`,
    streak: card.streak === 1 ? "1 day" : `${card.streak} days`,
    skills: card.skills,
    summary: `${name} fixed “${card.challenge_title}”${time ? ` in ${time}` : ""}, verified in a real Linux sandbox on greenbuild.`,
  };
}
