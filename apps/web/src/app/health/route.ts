export interface HealthStatus {
  status: "ok";
}

// Evaluated per request so the probe reflects a live server, not a build-time snapshot.
export const dynamic = "force-dynamic";

// Public on purpose: container and load balancer probes call it without credentials.
export function GET(): Response {
  const body: HealthStatus = { status: "ok" };
  return Response.json(body);
}
