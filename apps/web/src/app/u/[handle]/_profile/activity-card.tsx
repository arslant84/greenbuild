import type { PublicProfile } from "@greenbuild/shared";
import { ArrowForwardIcon } from "../../../../ui/icons-profile";
import { plural } from "./profile-view";
import { CARD, HEADLINE_SM, LABEL_BADGE, LABEL_CODE } from "./type";

const COLUMNS = ["INCIDENT / ROOT CAUSE", "DOMAIN", "SOLVE TIME", "DIFFICULTY", "DATE"];

// Frame 3:4532 › Recent Verified Activity. The public profile has no attempt history yet, so the table
// keeps its columns with an empty row and the audit chip shows "—"; the solved count is real. The frame's
// "microkernel telemetry" is not how greenbuild records solves; the history page does not exist yet (text).
export function ActivityCard({ profile }: { profile: PublicProfile }) {
  return (
    <section className={`${CARD} gap-3`}>
      <div className="flex items-center justify-between border-b border-control pb-2">
        <div>
          <h2 className={`${HEADLINE_SM} text-ink`}>Recent Verified Activity</h2>
          <p className="type-label text-ink-muted">Solved attempts, each checked in its own sandbox</p>
        </div>
        <span className={`rounded border border-ok/20 bg-ok/10 px-2 py-0.5 ${LABEL_BADGE} text-ok`}>— AUDIT PASS</span>
      </div>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-control type-label text-ink-subtle">
            {COLUMNS.map((column) => (
              <th key={column} className={`px-3 py-2 font-normal ${column === "DATE" ? "text-right" : ""}`}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="type-body">
          <tr>
            <td colSpan={COLUMNS.length} className="px-3 py-3 text-ink-muted">
              No attempts shown yet.
            </td>
          </tr>
        </tbody>
      </table>
      <span className={`flex items-center gap-1.5 pt-2 ${LABEL_CODE} text-accent-soft`}>
        View all {plural(profile.solved, "solved attempt")}
        <ArrowForwardIcon className="text-[16px]" />
      </span>
    </section>
  );
}
