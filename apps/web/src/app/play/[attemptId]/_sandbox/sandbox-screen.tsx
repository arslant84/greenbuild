"use client";

import type { AttemptResponse, ChallengeCard } from "@greenbuild/shared";
import { useState } from "react";
import { useNow } from "../../../../ui/use-now";
import { useSubmitShortcut } from "../../../../ui/use-shortcut";
import type { ConnectionStatus, TerminalSize } from "../protocol";
import { ActionPanel } from "./action-panel";
import { SandboxHeader } from "./header";
import { MissionPanel } from "./mission-panel";
import { SandboxTerminal } from "./sandbox-terminal";
import { ShortcutBar } from "./shortcut-bar";
import { PaneSwitcher, TerminalChrome, TerminalFooter } from "./terminal-bars";
import { useCheck } from "./use-check";

const MS_PER_SECOND = 1_000;

interface SandboxScreenProps {
  attempt: AttemptResponse;
  token: string;
  card: ChallengeCard;
  attachUrl: string;
  refresh: () => Promise<unknown>;
}

// Figma "Hotfix Sandbox — V1 Default State": header, terminal pane (920 px), mission panel (360 px), shortcuts.
export function SandboxScreen({ attempt, token, card, attachUrl, refresh }: SandboxScreenProps) {
  // Later reads of the attempt carry new tokens; the terminal keeps the one it connected with.
  const [sessionToken] = useState(token);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [size, setSize] = useState<TerminalSize | null>(null);
  const { state, check } = useCheck(attempt.id, refresh);
  const elapsed = (useNow() - Date.parse(attempt.started_at ?? attempt.created_at)) / MS_PER_SECOND;
  const incident = attempt.id.slice(0, 8).toUpperCase();
  const checking = state.kind === "checking";
  useSubmitShortcut(() => void check(), !checking);
  return (
    <div className="flex h-screen flex-col bg-canvas">
      <SandboxHeader incident={incident} elapsedSeconds={elapsed} />
      <main className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 flex-col">
          <PaneSwitcher status={status} />
          <TerminalChrome status={status} incident={incident} />
          <SandboxTerminal attachUrl={attachUrl} token={sessionToken} onStatus={setStatus} onSize={setSize} />
          <TerminalFooter size={size} />
        </section>
        <MissionPanel
          card={card}
          remainingSeconds={card.time_limit_sec - elapsed}
          checksUsed={attempt.checks_used}
          actions={<ActionPanel onCheck={() => void check()} checking={checking} canCheck={status === "connected"} />}
        />
      </main>
      <ShortcutBar running={status === "connected"} />
    </div>
  );
}
