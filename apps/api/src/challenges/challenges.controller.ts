import { challengeListQuerySchema, type ChallengeCard, type ChallengeList } from "@greenbuild/shared";
import { Controller, Get, Param, Query } from "@nestjs/common";
import { z } from "zod";
import type { AuthenticatedUser } from "../auth/dev-user-token.js";
import { CurrentUser } from "../auth/session.guard.js";
import { parseInput } from "../validation.js";
import { Catalog } from "./catalog.js";
import { challengeCard } from "./challenge-card.js";
import { LiveVersions } from "./live-versions.js";

const slugSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);

@Controller("v1/challenges")
export class ChallengesController {
  constructor(
    private readonly liveVersions: LiveVersions,
    private readonly catalog: Catalog,
  ) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser, @Query() query: unknown): Promise<ChallengeList> {
    return this.catalog.page(user.id, parseInput(challengeListQuerySchema, query));
  }

  @Get(":slug")
  async card(@Param("slug") slug: string): Promise<ChallengeCard> {
    const valid = parseInput(slugSchema, slug);
    return challengeCard(valid, await this.liveVersions.latest(valid));
  }
}
