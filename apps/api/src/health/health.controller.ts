import { Controller, Get } from "@nestjs/common";

export interface HealthStatus {
  status: "ok";
}

// Public on purpose: container and load balancer probes call it without credentials.
@Controller("health")
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: "ok" };
  }
}
