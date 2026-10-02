const SECONDS_PER_MINUTE = 60;

// formatClock shows seconds as mm:ss, the timer format in the Figma frames.
export function formatClock(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(clamped / SECONDS_PER_MINUTE);
  const seconds = clamped % SECONDS_PER_MINUTE;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
