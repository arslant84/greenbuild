import { AppError, NotFoundError, UnauthorizedError } from "@greenbuild/shared";
import { loadDevCheckConfig, type DevCheckConfig } from "../../../../config/dev-check";
import { checkResultSchema } from "./result";
import { verifyTicket, type Ticket } from "./ticket";

// The engine's checker has 20 s; this leaves room for copying it in and the round trip.
const CHECK_TIMEOUT_MS = 30_000;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_BAD_GATEWAY = 502;

export const dynamic = "force-dynamic";

// POST /play/{attemptId}/check stands in for the API's check endpoint (task 15): the browser sends
// the dev ticket, never the engine's internal token, which stays on this server.
export async function POST(request: Request, context: { params: Promise<{ attemptId: string }> }): Promise<Response> {
  const config = loadDevCheckConfig();
  if (!config) {
    return errorResponse(new NotFoundError("Not found"), HTTP_NOT_FOUND);
  }
  const { attemptId } = await context.params;
  const bearer = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  const ticket = verifyTicket(bearer, config.ticketSecret, Date.now());
  if (!ticket || ticket.attemptId !== attemptId) {
    return errorResponse(new UnauthorizedError("A valid check ticket for this attempt is required"), HTTP_UNAUTHORIZED);
  }
  return runCheck(config, ticket);
}

async function runCheck(config: DevCheckConfig, ticket: Ticket): Promise<Response> {
  const failed = errorResponse(new AppError("internal", "The check could not run"), HTTP_BAD_GATEWAY);
  try {
    const response = await fetch(`${config.internalUrl}/internal/attempts/${encodeURIComponent(ticket.attemptId)}/check`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.internalToken}`, "content-type": "application/json" },
      body: JSON.stringify({ sandbox_id: ticket.sandboxId, challenge_id: ticket.challengeId }),
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error("engine check failed", { attemptId: ticket.attemptId, status: response.status });
      return failed;
    }
    const result = checkResultSchema.safeParse(await response.json());
    if (!result.success) {
      console.error("engine check returned an unexpected body", { attemptId: ticket.attemptId });
      return failed;
    }
    return Response.json(result.data);
  } catch (error) {
    console.error("engine check unreachable", { attemptId: ticket.attemptId, error: String(error) });
    return failed;
  }
}

function errorResponse(error: AppError, status: number): Response {
  return Response.json(error.toResponse(), { status });
}
