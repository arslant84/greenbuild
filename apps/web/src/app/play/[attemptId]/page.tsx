import { loadEngineConfig } from "../../../config/engine";
import { PlayTerminal } from "./play-terminal";

interface PlayPageProps {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}

// Until the API issues tokens (tasks 14–16), the link from cmd/dev-attempt carries one.
export default async function PlayPage({ params, searchParams }: PlayPageProps) {
  const { attemptId } = await params;
  const { token } = await searchParams;
  const { attachUrl } = loadEngineConfig();

  return (
    <main>
      <h1>Attempt {attemptId}</h1>
      {typeof token === "string" && token !== "" ? (
        <PlayTerminal attachUrl={attachUrl} token={token} />
      ) : (
        <p>No attach token. Start an attempt with cmd/dev-attempt and open the link it prints.</p>
      )}
    </main>
  );
}
