// What a copy button shows after a click: done, refused by the browser, or nothing yet.
export type CopyResult = "copied" | "blocked" | null;

// copyText puts text on the clipboard. It answers false when the browser has no clipboard (a page that
// is not https) or refuses it (a blocked permission), so the screen can say so instead of doing nothing.
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
