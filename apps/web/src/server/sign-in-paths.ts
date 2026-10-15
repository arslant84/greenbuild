// The sign-in screen (task 30b), and the error that sends a player there to confirm being 16 or older.
export const SIGN_IN_PATH = "/signin";
export const AGE_REQUIRED_ERROR = "AgeRequired";
export const AGE_REQUIRED_PATH = `${SIGN_IN_PATH}?error=${AGE_REQUIRED_ERROR}`;
