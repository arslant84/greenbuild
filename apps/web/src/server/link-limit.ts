// Email link requests (task 30b-4; owner, 2026-10-15): 5 per address and 5 per IP in a 15-minute window.
export const LINK_REQUESTS_PER_WINDOW = 5;
export const LINK_WINDOW_SEC = 15 * 60;

// How long a sign-in link works, as the email and the sign-in screen state it; Auth.js's own default.
export const LINK_LIFETIME_HOURS = 24;
