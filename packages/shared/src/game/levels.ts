// architecture.md, "XP и уровни" (task 42b): level n needs 100 × n^1.5 XP in total, so a new player is
// level 0 until 100 XP, and each level takes longer than the one before.
export const LEVEL_XP_BASE = 100;
export const LEVEL_XP_EXPONENT = 1.5;

// xpForLevel is the total XP level n needs.
export function xpForLevel(level: number): number {
  return Math.round(LEVEL_XP_BASE * level ** LEVEL_XP_EXPONENT);
}

// levelForXp is the highest level the total XP reaches.
export function levelForXp(xp: number): number {
  let level = Math.max(0, Math.floor((xp / LEVEL_XP_BASE) ** (1 / LEVEL_XP_EXPONENT)));
  // The root can land one off at exact boundaries; the integer requirement decides.
  while (xpForLevel(level + 1) <= xp) {
    level++;
  }
  while (level > 0 && xpForLevel(level) > xp) {
    level--;
  }
  return level;
}

// levelProgress is how far the total XP is from its level to the next one, from 0 to 1.
export function levelProgress(xp: number): number {
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  return (xp - floor) / (xpForLevel(level + 1) - floor);
}
