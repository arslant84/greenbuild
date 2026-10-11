// architecture.md, "Античит — слой 2" (task 49b). Weights: low 1, medium 2, high 3. An attempt is
// flagged when the sum is above FLAG_THRESHOLD, so one strong signal alone does not flag it; a flagged
// attempt still earns XP and streak but stays out of the rating until reviewed (49c). tab_hidden,
// same_solution and multi_account need data the product does not collect yet.
export const SIGNAL_WEIGHTS = { paste_large: 2, idle_then_solve: 3, no_exploration: 3, instant_solve: 2, rating_jump: 2 } as const;
export const FLAG_THRESHOLD = 4;

const PASTE_LARGE_CHARS = 200;
const IDLE_SHARE = 0.7;
const INSTANT_SHARE = 0.2;
const RATING_JUMP_POINTS = 400;
// Commands that look around before changing anything; solving without any of them is no_exploration.
const READ_COMMANDS = new Set([
  "cat", "less", "more", "head", "tail", "ls", "find", "grep", "journalctl", "systemctl", "ps", "ss", "netstat",
  "lsof", "stat", "df", "du", "free", "top", "env", "printenv", "curl", "tree", "file", "id", "getent", "nginx", "docker",
]);

export type SignalName = keyof typeof SIGNAL_WEIGHTS;

export interface Signal {
  signal: SignalName;
  value: number;
  weight: number;
}

// LogEvent is the part of a session log line (apps/sandbox-engine/internal/sessionlog) the rules read.
export interface LogEvent {
  t: string;
  type: string;
  data?: string;
}

export interface AttemptFacts {
  solved: boolean;
  checksUsed: number;
  startedAt: Date;
  finishedAt: Date;
  durationMs: number | null;
  // The challenge's median solve time, or null with too few solves.
  medianSolveMs: number | null;
  // The challenge version's rating minus the player's weighted skill rating, or null without ratings.
  ratingGap: number | null;
}

// parseLog reads JSONL session logs; a line that is not an event (a torn last chunk) is skipped.
export function parseLog(text: string): LogEvent[] {
  return text.split("\n").flatMap((line) => {
    try {
      const event = JSON.parse(line) as Partial<LogEvent>;
      return typeof event.t === "string" && typeof event.type === "string" ? [event as LogEvent] : [];
    } catch {
      return [];
    }
  });
}

function signal(name: SignalName, value: number): Signal {
  return { signal: name, value, weight: SIGNAL_WEIGHTS[name] };
}

// readsSomething reports whether any part of a command line (split on pipes and ; && ||) starts with
// a read command, after sudo and VAR=value prefixes.
export function readsSomething(command: string): boolean {
  return command.split(/\|\||&&|[|;]/).some((part) => {
    const words = part.trim().split(/\s+/).filter((word) => word !== "sudo" && !/^[A-Za-z_]+=/.test(word));
    return READ_COMMANDS.has((words[0] ?? "").split("/").pop() ?? "");
  });
}

// longestIdleShare is the longest stretch without input, as a share of the attempt from ready to finish.
function longestIdleShare(events: LogEvent[], facts: AttemptFacts): number {
  const total = facts.finishedAt.getTime() - facts.startedAt.getTime();
  const times = [facts.startedAt.getTime(), ...events.filter((event) => event.type === "input").map((event) => Date.parse(event.t)), facts.finishedAt.getTime()];
  times.sort((a, b) => a - b);
  const gaps = times.slice(1).map((time, index) => time - (times[index] ?? time));
  return total > 0 ? Math.max(...gaps) / total : 0;
}

// logSignals are the signals read from the session log; null means the log could not be read.
function logSignals(events: LogEvent[], facts: AttemptFacts): Signal[] {
  const found: Signal[] = [];
  const longestPaste = Math.max(0, ...events.filter((event) => event.type === "input").map((event) => (event.data ?? "").length));
  if (longestPaste > PASTE_LARGE_CHARS) {
    found.push(signal("paste_large", longestPaste));
  }
  if (!facts.solved) {
    return found;
  }
  const idle = longestIdleShare(events, facts);
  if (facts.checksUsed === 1 && idle > IDLE_SHARE) {
    found.push(signal("idle_then_solve", idle));
  }
  if (!events.some((event) => event.type === "command" && readsSomething(event.data ?? ""))) {
    found.push(signal("no_exploration", 1));
  }
  return found;
}

// findSignals applies the rules to one finished attempt.
export function findSignals(events: LogEvent[] | null, facts: AttemptFacts): Signal[] {
  const found = events ? logSignals(events, facts) : [];
  if (facts.solved && facts.durationMs !== null && facts.medianSolveMs !== null && facts.durationMs < INSTANT_SHARE * facts.medianSolveMs) {
    found.push(signal("instant_solve", facts.durationMs / facts.medianSolveMs));
  }
  if (facts.solved && facts.ratingGap !== null && facts.ratingGap >= RATING_JUMP_POINTS) {
    found.push(signal("rating_jump", facts.ratingGap));
  }
  return found;
}

export function isFlagged(signals: Signal[]): boolean {
  return signals.reduce((sum, found) => sum + found.weight, 0) > FLAG_THRESHOLD;
}
