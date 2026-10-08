// hints.md holds one "## Hint N" section per hint, weakest first (architecture.md "Challenge specification").
const HINT_HEADING = /^## Hint \d+[ \t]*$/m;

// parseHints returns each hint's text in file order: what follows its heading, up to the next one.
export function parseHints(markdown: string): string[] {
  return markdown
    .split(new RegExp(HINT_HEADING.source, "gm"))
    .slice(1)
    .map((section) => section.trim());
}
