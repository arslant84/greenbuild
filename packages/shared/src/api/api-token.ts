// The token the web app issues for each signed-in API call (architecture.md, task 30c): ES256, signed
// with the web app's private key and verified by the API with the public one, valid for 5 minutes.
export const API_TOKEN_ALGORITHM = "ES256";
export const API_TOKEN_ISSUER = "greenbuild-web";
export const API_TOKEN_AUDIENCE = "greenbuild-api";
export const API_TOKEN_LIFETIME_SEC = 5 * 60;
