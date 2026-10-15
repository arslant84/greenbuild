// The entry the web app's sign-in imports (@greenbuild/db/auth): the Auth.js adapter and a connection,
// without the seed and migration code, which read the challenges and migrations from disk.
export { authAdapter, type AuthAdapterOptions } from "./auth-adapter.js";
export { confirmUser, hasAgeConfirmation, recordAgeConfirmation } from "./sign-up.js";
export { connect } from "./client.js";
