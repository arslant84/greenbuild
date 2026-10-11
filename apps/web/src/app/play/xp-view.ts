import { levelProgress } from "@greenbuild/shared";

// xpAmount shows an XP number, or the neutral "—" while there is none (Figma rule: no sample values).
export function xpAmount(xp: number | null | undefined): string {
  return xp === null || xp === undefined ? "—" : String(xp);
}

export interface LevelView {
  level: string;
  // 0–1, for the ring's arc.
  progress: number;
  percent: string;
}

// levelView is the Daily status bar's level ring for the player's XP, or empty without a profile.
export function levelView(player: { xp: number; level: number } | null): LevelView {
  if (!player) {
    return { level: "—", progress: 0, percent: "0%" };
  }
  const progress = levelProgress(player.xp);
  return { level: String(player.level), progress, percent: `${Math.floor(progress * 100)}%` };
}
