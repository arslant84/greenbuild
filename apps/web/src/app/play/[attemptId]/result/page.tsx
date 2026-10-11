import { attemptResultSchema, challengeCardSchema } from "@greenbuild/shared";
import { notFound } from "next/navigation";
import { z } from "zod";
import { apiGet } from "../../../../server/api";
import { Credential } from "./_debrief/credential";
import { DebriefFrame } from "./_debrief/frame";
import { outcomeOf } from "./_debrief/outcome";
import { NextActions, Postmortem } from "./_debrief/postmortem";
import { Summary } from "./_debrief/summary";

export const dynamic = "force-dynamic";

interface ResultPageProps {
  params: Promise<{ attemptId: string }>;
}

// /play/{attemptId}/result: Figma "Incident Debrief & Verifiable Credential". Owner only.
export default async function ResultPage({ params }: ResultPageProps) {
  const { attemptId } = await params;
  if (!z.uuid().safeParse(attemptId).success) {
    notFound();
  }
  const result = await apiGet(`/v1/attempts/${attemptId}/result`, attemptResultSchema);
  if (!result) {
    notFound();
  }
  const card = await apiGet(`/v1/challenges/${result.challenge_slug}`, challengeCardSchema);
  const outcome = outcomeOf(result.status);
  return (
    <DebriefFrame incident={attemptId.slice(0, 8).toUpperCase()} outcome={outcome}>
      <Summary title={card?.title ?? result.challenge_slug} outcome={outcome} durationMs={result.duration_ms} xpEarned={result.xp_earned} />
      <Postmortem />
      <Credential result={result} skills={card?.skills ?? []} />
      <NextActions />
    </DebriefFrame>
  );
}
