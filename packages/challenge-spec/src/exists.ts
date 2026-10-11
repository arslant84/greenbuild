import { access } from "node:fs/promises";

// exists reports whether a path is there; the scaffold and the draft never write over a folder.
export async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
