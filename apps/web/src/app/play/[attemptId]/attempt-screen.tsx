"use client";

import type { AttemptResponse, ChallengeCard } from "@greenbuild/shared";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PlayTerminal } from "./play-terminal";
import { Provisioning } from "./provisioning";
import { isFinished, useAttempt } from "./use-attempt";

interface AttemptScreenProps {
  initial: AttemptResponse;
  card: ChallengeCard;
  attachUrl: string;
}

// AttemptScreen follows the attempt: provisioning while the sandbox starts, the sandbox once it is
// ready, and the result once the attempt is over.
export function AttemptScreen({ initial, card, attachUrl }: AttemptScreenProps) {
  const router = useRouter();
  const { attempt } = useAttempt(initial);
  useEffect(() => {
    if (isFinished(attempt.status)) {
      router.replace(`/play/${attempt.id}/result`);
    }
  }, [attempt.id, attempt.status, router]);

  if (attempt.status === "starting") {
    return <Provisioning card={card} attemptId={attempt.id} createdAt={attempt.created_at} />;
  }
  if (attempt.status === "ready" && attempt.attach_token) {
    return <PlayTerminal attachUrl={attachUrl} token={attempt.attach_token} />;
  }
  return null;
}
