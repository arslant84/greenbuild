// ownProfilePath: the public profile lives at /u/{handle}. A player without a handle has none yet, so they go
// to the settings, where they pick one.
export function ownProfilePath(handle: string | null): string {
  return handle ? `/u/${handle}` : "/settings";
}
