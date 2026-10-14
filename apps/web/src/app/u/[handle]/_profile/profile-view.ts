import { levelProgress, type PublicProfile } from "@greenbuild/shared";
import { skillStyle } from "../../../../ui/skills";

// The public profile screen's logic (the Figma frame Profile Multi-State Evaluator, 3:4532, state "V5:
// SEO Public", read from its Stitch copy; task 46b).

type Skill = PublicProfile["skills"][number];

// The frame lists five skills and a "Show all" button for the rest.
export const SKILLS_SHOWN = 5;
// The rating track spans the scale the profile frame 3:2750 names: 1,000 to 2,200.
const TRACK_MIN = 1000;
const TRACK_MAX = 2200;
// The level ring's circle has r = 20 in the frame's 48 × 48 view box.
const RING_CIRCUMFERENCE = 2 * Math.PI * 20;
const PERCENT = 100;

export function profileName(profile: PublicProfile): string {
  return profile.display_name ?? `@${profile.handle}`;
}

// profileInitials takes the first letters of the display name's first two words, or of the handle.
export function profileInitials(profile: PublicProfile): string {
  const words = (profile.display_name ?? "").split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? `${words[0]?.[0] ?? ""}${words[1]?.[0] ?? ""}` : (words[0] ?? profile.handle).slice(0, 2);
  return letters.toUpperCase();
}

export interface LevelRing {
  dashOffset: number;
  toNext: string;
}

// levelRing is how much of the ring the progress to the next level fills, and its label ("91.4% to L20").
export function levelRing(profile: PublicProfile): LevelRing {
  const progress = levelProgress(profile.xp);
  return {
    dashOffset: RING_CIRCUMFERENCE * (1 - progress),
    toNext: `${(progress * PERCENT).toFixed(1)}% to L${profile.level + 1}`,
  };
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US");
}

export function plural(count: number, word: string): string {
  return `${formatNumber(count)} ${word}${count === 1 ? "" : "s"}`;
}

function trackPercent(rating: number): number {
  const clamped = Math.min(TRACK_MAX, Math.max(TRACK_MIN, rating));
  return ((clamped - TRACK_MIN) / (TRACK_MAX - TRACK_MIN)) * PERCENT;
}

export interface SkillRow {
  key: string;
  position: string;
  name: string;
  rating: string;
  spread: string;
  interval: string;
  attempts: string;
  band: { left: number; width: number };
  point: number;
}

function skillRow(skill: Skill, index: number): SkillRow {
  const [low, high] = skill.interval;
  const bandLeft = trackPercent(low);
  return {
    key: skill.skill,
    position: String(index + 1).padStart(2, "0"),
    name: skillStyle(skill.skill).label,
    rating: formatNumber(skill.rating),
    spread: `±${formatNumber(Math.round((high - low) / 2))}`,
    interval: `[${formatNumber(low)} – ${formatNumber(high)}]`,
    attempts: plural(skill.attempts, "attempt"),
    band: { left: bandLeft, width: trackPercent(high) - bandLeft },
    point: trackPercent(skill.rating),
  };
}

// skillRows are the skills as the frame lists them, strongest first; the first five unless expanded.
export function skillRows(profile: PublicProfile, expanded: boolean): SkillRow[] {
  const shown = expanded ? profile.skills : profile.skills.slice(0, SKILLS_SHOWN);
  return shown.map(skillRow);
}

export function profileTitle(profile: PublicProfile): string {
  return `${profileName(profile)} (@${profile.handle}) · greenbuild`;
}

// profileDescription is the page's search snippet: level, solves and the strongest skill, all real data.
export function profileDescription(profile: PublicProfile): string {
  const strongest = profile.skills[0];
  const skill = strongest ? ` Strongest skill: ${skillStyle(strongest.skill).label}, rated ${formatNumber(strongest.rating)}.` : "";
  return `@${profile.handle} on greenbuild: level ${profile.level}, ${plural(profile.solved, "incident")} solved in live sandboxes.${skill}`;
}
