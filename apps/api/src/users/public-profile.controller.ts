import { handleSchema, type PublicProfile } from "@greenbuild/shared";
import { Controller, Get, Param } from "@nestjs/common";
import { Public } from "../auth/public.js";
import { parseInput } from "../validation.js";
import { PublicProfiles } from "./public-profile.js";

// Public: listed in architecture.md's API rules, checked by the route test (task 30c).
@Controller("v1/users")
export class PublicProfileController {
  constructor(private readonly profiles: PublicProfiles) {}

  @Public()
  @Get(":handle")
  byHandle(@Param("handle") handle: string): Promise<PublicProfile> {
    return this.profiles.byHandle(parseInput(handleSchema, handle));
  }
}
