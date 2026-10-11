// architecture.md, "XP и уровни" (task 42a): XP rewards solving and keeps growing; it is not the rating.
export const XP_PER_DIFFICULTY = 10;
export const XP_SPEED_BONUS_MAX = 0.5;
export const XP_HINT_PENALTY = 0.2;
export const XP_DAILY_MULTIPLIER = 1.5;
export const XP_NEW_SKILL_BONUS = 25;
// Below this many earlier solves a challenge's median time says little, so there is no speed bonus.
export const XP_MEDIAN_MIN_SOLVES = 5;

export interface SolveXpInput {
  difficulty: number;
  // From the sandbox being ready to the solve; null when unknown.
  durationMs: number | null;
  // Median solve time of the challenge, or null with fewer than XP_MEDIAN_MIN_SOLVES solves.
  medianDurationMs: number | null;
  hintsUsed: number;
  daily: boolean;
  // Skills of the challenge the player had not solved before.
  newSkills: number;
}

export interface SolveXp {
  solve: number;
  newSkills: number;
}

// speedBonus is the share of the median time saved, up to XP_SPEED_BONUS_MAX: half the median or
// faster earns the whole bonus, the median or slower earns none.
export function speedBonus(durationMs: number | null, medianDurationMs: number | null): number {
  if (durationMs === null || medianDurationMs === null || medianDurationMs <= 0) {
    return 0;
  }
  return Math.min(XP_SPEED_BONUS_MAX, Math.max(0, 1 - durationMs / medianDurationMs));
}

// solveXp is what a solved attempt earns: the solve itself and the bonus for new skills.
export function solveXp(input: SolveXpInput): SolveXp {
  const base = XP_PER_DIFFICULTY * input.difficulty;
  const hints = Math.max(0, 1 - XP_HINT_PENALTY * input.hintsUsed);
  const daily = input.daily ? XP_DAILY_MULTIPLIER : 1;
  return {
    solve: Math.round(base * (1 + speedBonus(input.durationMs, input.medianDurationMs)) * hints * daily),
    newSkills: XP_NEW_SKILL_BONUS * input.newSkills,
  };
}
