// API contract: list endpoints use cursor pagination with `limit` ≤ 100.
export const MAX_PAGE_LIMIT = 100;

// Used when PORT is not set, e.g. local development.
export const API_DEFAULT_PORT = 3000;
export const WORKER_DEFAULT_PORT = 3002;

// architecture.md: an attempt may run the checker at most 10 times.
export const ATTEMPT_MAX_CHECKS = 10;

// Seeds travel as JSON numbers between the API and the engine; larger ones lose precision in TypeScript.
export const SEED_MAX = Number.MAX_SAFE_INTEGER;

// Glicko-2 starting values for an unrated player skill or challenge version.
export const GLICKO_INITIAL_RATING = 1500;
export const GLICKO_INITIAL_RATING_DEVIATION = 350;
export const GLICKO_INITIAL_VOLATILITY = 0.06;

// architecture.md: challenge difficulty is 1–10 and a challenge has at most 3 hints.
export const CHALLENGE_DIFFICULTY_MAX = 10;
export const CHALLENGE_HINTS_MAX = 3;

// architecture.md, task 32: profile limits, and a timezone that changes at most once in 30 days so a
// streak day cannot be won by switching zones.
export const HANDLE_MIN = 3;
export const HANDLE_MAX = 32;
export const DISPLAY_NAME_MAX = 64;
export const TIMEZONE_CHANGE_INTERVAL_DAYS = 30;

// architecture.md, decision D1: one track, Linux/DevOps. Task 41a: a challenge is not the daily
// challenge of a track again within 180 days.
export const DAILY_TRACKS = ["linux"] as const;
export const DAILY_REPEAT_WINDOW_DAYS = 180;
