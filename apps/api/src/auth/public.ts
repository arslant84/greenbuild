import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC = "greenbuild:public";

// Public lets a route answer without a session. Every public route is listed in architecture.md
// ("API contract" › rules); routes.e2e.test.ts fails when the two differ.
export const Public = () => SetMetadata(IS_PUBLIC, true);
