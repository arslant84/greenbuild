// firstLine returns the checker's first non-empty line, which says what is still wrong.
export function firstLine(output: string): string {
  return output.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
}
