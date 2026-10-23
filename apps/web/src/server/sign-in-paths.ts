// The sign-in screen (task 30b), and the error that sends a player there to confirm being 16 or older.
export const SIGN_IN_PATH = "/signin";
export const AGE_REQUIRED_ERROR = "AgeRequired";
export const AGE_REQUIRED_PATH = `${SIGN_IN_PATH}?error=${AGE_REQUIRED_ERROR}`;

// A banned or deleted account may not sign in (task 50b).
export const ACCOUNT_CLOSED_ERROR = "AccountClosed";
export const ACCOUNT_CLOSED_PATH = `${SIGN_IN_PATH}?error=${ACCOUNT_CLOSED_ERROR}`;

// Too many email link requests (task 30b-4). Auth.js hands the screen `code` along with `error`, so it
// carries the seconds left.
export const RATE_LIMITED_ERROR = "RateLimited";

export function rateLimitedPath(waitSec: number): string {
  return `${SIGN_IN_PATH}?error=${RATE_LIMITED_ERROR}&code=${waitSec}`;
}
