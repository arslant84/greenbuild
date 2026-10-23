import { ACCOUNT_CLOSED_ERROR, AGE_REQUIRED_ERROR } from "../../../server/sign-in-paths";

// What the sign-in screen (Figma 7:9957, task 30b) says above the form for the error Auth.js, or the
// 16+ rule, sends back in `?error=`. The frame draws the OAuth error (V4); the others use its banner.
export interface SignInBanner {
  title: string;
  text: string;
}

const OAUTH_FAILED: SignInBanner = { title: "Authentication Failed:", text: "Couldn't connect to GitHub. Try again or continue using email." };

const BANNERS: Record<string, SignInBanner> = {
  [AGE_REQUIRED_ERROR]: { title: "Confirm your age:", text: "Tick “I am 16 or older” to create your account or continue to it." },
  // One text for banned and deleted accounts (owner, 2026-10-23): it does not say why.
  [ACCOUNT_CLOSED_ERROR]: { title: "Account closed:", text: "This account can no longer be used to sign in." },
  Verification: { title: "Link expired:", text: "This sign-in link has expired or was already used. Ask for a new one." },
  OAuthAccountNotLinked: { title: "Authentication Failed:", text: "This email already signs in another way. Use that, or continue using email." },
  OAuthSignin: OAUTH_FAILED,
  OAuthCallback: OAUTH_FAILED,
  OAuthCallbackError: OAUTH_FAILED,
  AccessDenied: OAUTH_FAILED,
};

const SIGN_IN_FAILED: SignInBanner = { title: "Authentication Failed:", text: "Sign-in did not work. Try again, or continue using email." };

export function signInBanner(error: string | undefined): SignInBanner | null {
  if (!error) {
    return null;
  }
  return BANNERS[error] ?? SIGN_IN_FAILED;
}
