"use client";

import { useState } from "react";
import { checkResultSchema } from "./check/result";

type CheckState =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "done"; passed: boolean; outputTail: string }
  | { kind: "error" };

interface CheckButtonProps {
  attemptId: string;
  ticket: string;
}

export function CheckButton({ attemptId, ticket }: CheckButtonProps) {
  const [state, setState] = useState<CheckState>({ kind: "idle" });

  async function check(): Promise<void> {
    setState({ kind: "checking" });
    setState(await requestCheck(attemptId, ticket));
  }

  return (
    <section>
      <button type="button" onClick={() => void check()} disabled={state.kind === "checking"}>
        {state.kind === "checking" ? "Checking…" : "Check"}
      </button>
      {state.kind === "done" && (
        <>
          <p role="status">{state.passed ? "Passed" : "Not solved yet"}</p>
          <pre>{state.outputTail}</pre>
        </>
      )}
      {state.kind === "error" && <p role="alert">The check could not run. Try again.</p>}
    </section>
  );
}

async function requestCheck(attemptId: string, ticket: string): Promise<CheckState> {
  try {
    const response = await fetch(`/play/${encodeURIComponent(attemptId)}/check`, {
      method: "POST",
      headers: { authorization: `Bearer ${ticket}` },
    });
    if (!response.ok) {
      return { kind: "error" };
    }
    const result = checkResultSchema.safeParse(await response.json());
    if (!result.success) {
      return { kind: "error" };
    }
    return { kind: "done", passed: result.data.passed, outputTail: result.data.output_tail };
  } catch {
    return { kind: "error" };
  }
}
