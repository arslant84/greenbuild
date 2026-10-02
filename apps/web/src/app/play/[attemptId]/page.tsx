import { attemptResponseSchema, challengeCardSchema } from "@greenbuild/shared";
import { notFound } from "next/navigation";
import { z } from "zod";
import { loadEngineConfig } from "../../../config/engine";
import { apiGet } from "../../../server/api";
import { ServiceError } from "../service-error";
import { AttemptScreen } from "./attempt-screen";

export const dynamic = "force-dynamic";

interface AttemptPageProps {
  params: Promise<{ attemptId: string }>;
}

// /play/{attemptId}: the attempt's own screens. Another player's attempt is "not found".
export default async function AttemptPage({ params }: AttemptPageProps) {
  const { attemptId } = await params;
  if (!z.uuid().safeParse(attemptId).success) {
    notFound();
  }
  const attempt = await apiGet(`/v1/attempts/${attemptId}`, attemptResponseSchema);
  if (!attempt) {
    notFound();
  }
  const card = await apiGet(`/v1/challenges/${attempt.challenge_slug}`, challengeCardSchema);
  if (!card) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <ServiceError />
      </div>
    );
  }
  return <AttemptScreen initial={attempt} card={card} attachUrl={loadEngineConfig().attachUrl} />;
}
