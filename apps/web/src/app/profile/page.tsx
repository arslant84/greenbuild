import { meResponseSchema } from "@greenbuild/shared";
import { redirect } from "next/navigation";
import { apiGet } from "../../server/api";
import { ServiceError } from "../play/service-error";
import { ownProfilePath } from "./own-profile";

export const dynamic = "force-dynamic";

// /profile: the signed-in player's own profile, so navigation can link to it without knowing the handle.
export default async function OwnProfilePage() {
  const me = await apiGet("/v1/me", meResponseSchema);
  if (!me) {
    return (
      <main data-responsive className="flex min-h-screen items-center justify-center bg-[#131314] px-4">
        <ServiceError retryHref="/profile" message="Your profile could not be loaded." />
      </main>
    );
  }
  redirect(ownProfilePath(me.handle));
}
