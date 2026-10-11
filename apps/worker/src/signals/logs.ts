import { BlobServiceClient, type ContainerClient } from "@azure/storage-blob";
import { type LogEvent, parseLog } from "./rules.js";

// The engine's sessions container and naming (apps/sandbox-engine/internal/sessionlog: Container, Name):
// yyyy/mm/{attempt_id}.jsonl, by the month each terminal session started.
const SESSIONS_CONTAINER = "sessions";

// SessionLogs reads an attempt's session log; null means there is none to read.
export interface SessionLogs {
  read(attemptId: string, from: Date, to: Date): Promise<LogEvent[] | null>;
}

// monthsBetween lists every yyyy/mm from from to to, as an attempt's sessions may cross a month.
export function monthsBetween(from: Date, to: Date): string[] {
  const months: string[] = [];
  const cursor = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1));
  while (cursor <= to) {
    months.push(`${cursor.getUTCFullYear()}/${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

export class BlobSessionLogs implements SessionLogs {
  private readonly container: ContainerClient;

  constructor(connectionString: string) {
    this.container = BlobServiceClient.fromConnectionString(connectionString).getContainerClient(SESSIONS_CONTAINER);
  }

  async read(attemptId: string, from: Date, to: Date): Promise<LogEvent[] | null> {
    let found = false;
    let text = "";
    for (const month of monthsBetween(from, to)) {
      const blob = this.container.getBlobClient(`${month}/${attemptId}.jsonl`);
      if (await blob.exists()) {
        found = true;
        text += (await blob.downloadToBuffer()).toString("utf8");
      }
    }
    return found ? parseLog(text) : null;
  }
}
