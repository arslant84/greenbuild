"use client";

import type { AttemptResponse, ChallengeCard } from "@greenbuild/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SandboxScreen } from "./_sandbox/sandbox-screen";
import { PhoneNotice } from "./phone-notice";
import { Provisioning } from "./provisioning";
import { isFinished, useAttempt } from "./use-attempt";

interface AttemptScreenProps {
  initial: AttemptResponse;
  card: ChallengeCard;
  attachUrl: string;
}

// AttemptScreen follows the attempt: provisioning while the sandbox starts, the sandbox once it is
// ready, and the result once it is over. A solve in this session stays on the sandbox's solved state.
export function AttemptScreen({ initial, card, attachUrl }: AttemptScreenProps) {
  const router = useRouter();
  const { attempt, refresh } = useAttempt(initial);
  const [token, setToken] = useState(initial.attach_token);
  const solvedHere = attempt.status === "solved" && initial.status !== "solved";
  // The first attach token the attempt gets is kept; set while rendering, not in an effect.
  if (!token && attempt.attach_token) {
    setToken(attempt.attach_token);
  }
  useEffect(() => {
    if (isFinished(attempt.status) && !solvedHere) {
      router.replace(`/play/${attempt.id}/result`);
    }
  }, [attempt.id, attempt.status, solvedHere, router]);

  if (attempt.status === "starting") {
    return <Provisioning card={card} attemptId={attempt.id} createdAt={attempt.created_at} />;
  }
  if ((attempt.status === "ready" || solvedHere) && token) {
    // A phone sees the notice; from 768 px the sandbox keeps its 1280 px minimum (task 56).
    return (
      <div data-responsive>
        <PhoneNotice card={card} startedAt={attempt.started_at ?? attempt.created_at} />
        <div className="hidden md:block md:min-w-[1280px]">
          <SandboxScreen attempt={attempt} token={token} card={card} attachUrl={attachUrl} refresh={refresh} />
        </div>
      </div>
    );
  }
  return null;
}
