import type { ChallengeCard } from "@greenbuild/shared";
import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { z } from "zod";
import { DevUserGuard } from "../auth/dev-user.guard.js";
import { parseInput } from "../validation.js";
import { challengeCard } from "./challenge-card.js";
import { LiveVersions } from "./live-versions.js";

const slugSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);

@Controller("v1/challenges")
@UseGuards(DevUserGuard)
export class ChallengesController {
  constructor(private readonly liveVersions: LiveVersions) {}

  @Get(":slug")
  async card(@Param("slug") slug: string): Promise<ChallengeCard> {
    const valid = parseInput(slugSchema, slug);
    return challengeCard(valid, await this.liveVersions.latest(valid));
  }
}
