import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { ErrorResponse } from "@greenbuild/shared";

const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;
const HTTP_METHOD_NOT_ALLOWED = 405;

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function handleRequest(request: IncomingMessage, response: ServerResponse): void {
  if (request.url !== "/health") {
    const notFound: ErrorResponse = { code: "not_found", message: "Not found" };
    sendJson(response, HTTP_NOT_FOUND, notFound);
    return;
  }
  if (request.method !== "GET") {
    const notAllowed: ErrorResponse = { code: "validation_failed", message: "Method not allowed" };
    sendJson(response, HTTP_METHOD_NOT_ALLOWED, notAllowed);
    return;
  }
  sendJson(response, HTTP_OK, { status: "ok" });
}

// The worker has no public API; this server exists only for container liveness probes.
export function createHealthServer(): Server {
  return createServer(handleRequest);
}
