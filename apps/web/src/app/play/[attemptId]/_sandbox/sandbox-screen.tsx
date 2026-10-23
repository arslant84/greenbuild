"use client";

import { ATTEMPT_MAX_CHECKS, type AttemptResponse, type ChallengeCard } from "@greenbuild/shared";
import { useEffect, useState } from "react";
import { useNow } from "../../../../ui/use-now";
import { useSubmitShortcut } from "../../../../ui/use-shortcut";
import type { ConnectionStatus, TerminalSize } from "../protocol";
import { ActionPanel } from "./action-panel";
import { SandboxHeader } from "./header";
import { HintControl } from "./hint-button";
import { HintsCard } from "./hints-card";
import { MissionPanel } from "./mission-panel";
import { SandboxTerminal } from "./sandbox-terminal";
import { type SandboxView, sandboxView } from "./sandbox-view";
import { ShortcutBar } from "./shortcut-bar";
import { FailureBanner, ReconnectBanner, SuccessBanner } from "./states/check-banners";
import { CheckingOverlay } from "./states/checking-overlay";
import { AmberAlert, CheckerOutput, DisconnectedCard } from "./states/panel-blocks";
import { SolvedPanel } from "./states/solved-panel";
import { PaneSwitcher, TerminalChrome, TerminalFooter } from "./terminal-bars";
import { type CheckState, useCheck } from "./use-check";
import { useLeave } from "./use-leave";
import { MAX_RECONNECTS, useReconnect } from "./use-reconnect";

const MS_PER_SECOND = 1_000;

interface SandboxScreenProps {
  attempt: AttemptResponse;
  token: string;
  card: ChallengeCard;
  attachUrl: string;
  refresh: () => Promise<AttemptResponse | null>;
}

// Figma "Hotfix Sandbox" V1–V5: V1's layout for every state, with each state's own elements on top
// (owner's decision, 2026-10-02). The terminal never moves or resizes between states.
export function SandboxScreen({ attempt, token, card, attachUrl, refresh }: SandboxScreenProps) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [size, setSize] = useState<TerminalSize | null>(null);
  const { state: check, check: runCheck } = useCheck(attempt.id, refresh);
  const reconnect = useReconnect(token, status, refresh);
  const leave = useLeave(attempt.id);
  const elapsed = (useNow() - Date.parse(attempt.started_at ?? attempt.created_at)) / MS_PER_SECOND;
  const solvedIn = useSolvedTime(check, elapsed);
  const view = sandboxView(status, check, attempt.checks_used);
  const incident = attempt.id.slice(0, 8).toUpperCase();
  useSubmitShortcut(() => void runCheck(), view.mode === "ready");
  useRefreshWhenTimeIsUp(card.time_limit_sec - elapsed, refresh);
  return (
    <div className="flex h-screen flex-col bg-canvas">
      <SandboxHeader incident={incident} elapsedSeconds={solvedIn ?? elapsed} onExit={leave.exit} />
      <main className="flex min-h-0 flex-1">
        <section className="relative flex min-w-0 flex-1 flex-col">
          <PaneSwitcher status={status} />
          <StateBanner view={view} check={check} retry={reconnect.retry} onReconnect={() => void reconnect.reconnectNow()} />
          <TerminalChrome status={status} incident={incident} />
          <SandboxTerminal key={reconnect.token} attachUrl={attachUrl} token={reconnect.token} onStatus={setStatus} onSize={setSize} locked={view.frame === "V2"} />
          <TerminalFooter size={size} notice={footerNotice(view)} />
          {view.frame === "V2" && <CheckingOverlay />}
        </section>
        {solvedIn !== null ? (
          <SolvedPanel attemptId={attempt.id} solvedInSeconds={solvedIn} checksUsed={attempt.checks_used} />
        ) : (
          <MissionPanel
            card={card}
            remainingSeconds={card.time_limit_sec - elapsed}
            checksUsed={attempt.checks_used}
            extra={<PanelExtra view={view} check={check} attempt={attempt} />}
            actions={<ActionPanel mode={view.mode} hint={<HintControl attempt={attempt} ready={view.mode === "ready"} refresh={refresh} />} onCheck={() => void runCheck()} onGiveUp={leave.giveUp} />}
          />
        )}
      </main>
      <ShortcutBar running={status === "connected"} />
    </div>
  );
}

// When the time limit passes the engine removes the sandbox; reading the attempt then shows it expired.
function useRefreshWhenTimeIsUp(remainingSeconds: number, refresh: () => Promise<unknown>): void {
  const timeIsUp = remainingSeconds <= 0;
  useEffect(() => {
    if (timeIsUp) {
      void refresh();
    }
  }, [timeIsUp, refresh]);
}

// useSolvedTime freezes the clock at the moment a check passed.
function useSolvedTime(check: CheckState, elapsed: number): number | null {
  const [solvedIn, setSolvedIn] = useState<number | null>(null);
  const passed = check.kind === "done" && check.result.passed;
  if (passed && solvedIn === null) {
    setSolvedIn(elapsed);
  }
  return solvedIn;
}

interface StateBannerProps {
  view: SandboxView;
  check: CheckState;
  retry: number;
  onReconnect: () => void;
}

function StateBanner({ view, check, retry, onReconnect }: StateBannerProps) {
  const output = check.kind === "done" ? check.result.output_tail : "";
  if (view.frame === "V3") return <SuccessBanner output={output} />;
  if (view.frame === "V4") return <FailureBanner output={output} checksLeft={view.checksLeft} />;
  if (view.frame === "V5") return <ReconnectBanner retry={retry} maxRetries={MAX_RECONNECTS} onReconnect={onReconnect} />;
  return null;
}

// The opened hints (Stitch V6, task 35c) come first, under the checks card; then the state's own blocks.
function PanelExtra({ view, check, attempt }: { view: SandboxView; check: CheckState; attempt: AttemptResponse }) {
  return (
    <>
      <HintsCard hints={attempt.hints} total={attempt.hints_total} />
      <StateBlocks view={view} check={check} />
    </>
  );
}

function StateBlocks({ view, check }: { view: SandboxView; check: CheckState }) {
  if (view.frame === "V5") return <DisconnectedCard />;
  if (view.checksLeft === 0) return <AmberAlert>All checks for this attempt are used.</AmberAlert>;
  if (view.frame !== "V4" || check.kind !== "done") return null;
  return (
    <>
      <AmberAlert>{`${ATTEMPT_MAX_CHECKS - view.checksLeft} of ${ATTEMPT_MAX_CHECKS} checks used. You have ${view.checksLeft} remaining checks for this attempt.`}</AmberAlert>
      <CheckerOutput output={check.result.output_tail} />
    </>
  );
}

function footerNotice(view: SandboxView): { text: string; tone: "accent" | "danger" } | null {
  if (view.frame === "V2") return { text: "VALIDATION HARNESS RUNNING", tone: "accent" };
  if (view.frame === "V4") return { text: "STATUS: VALIDATION_FAILED", tone: "danger" };
  return null;
}
