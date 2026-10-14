import { handleSchema, meResponseSchema, type PublicProfile, publicProfileSchema } from "@greenbuild/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { apiGet, apiGetPublic } from "../../../server/api";
import { CredentialHeader, TrustStrip } from "./_profile/credential-header";
import { ProfileFooter } from "./_profile/profile-footer";
import { ProfileTopNav } from "./_profile/profile-top-nav";
import { profileDescription, profileTitle } from "./_profile/profile-view";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ handle: string }> };

// One API read per request for both the page and its metadata. An unknown, private, banned or deleted
// profile is the same 404 (task 46a), so the page does not reveal which handles exist.
const loadProfile = cache(async (raw: string): Promise<PublicProfile | null> => {
  const handle = handleSchema.safeParse(raw);
  return handle.success ? apiGetPublic(`/v1/users/${handle.data}`, publicProfileSchema) : null;
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const profile = await loadProfile((await params).handle);
  if (!profile) {
    return { title: "Profile not found · greenbuild", robots: { index: false } };
  }
  return { title: profileTitle(profile), description: profileDescription(profile) };
}

// Figma "Profile Multi-State Evaluator" (3:4532), state V5 "SEO Public", laid out from its Stitch copy
// (owner, 2026-10-14); task 46b. Rendered for every visitor alike, without a session.
export default async function ProfilePage({ params }: Params) {
  const profile = await loadProfile((await params).handle);
  if (!profile) {
    notFound();
  }
  // Only the nav's "Profile" link depends on the visitor: their own profile when signed in.
  const me = await apiGet("/v1/me", meResponseSchema);
  return (
    <div className="min-h-screen bg-[#131314]">
      {/* The content and its bars span the whole window (owner, 2026-10-14). */}
      <div className="frame flex min-h-screen flex-col">
        <ProfileTopNav ownHref={me?.handle ? `/u/${me.handle}` : null} />
        <CredentialHeader profile={profile} />
        <TrustStrip />
        {/* The frame's two columns of cards come in the next part of task 46b. */}
        <main className="grid flex-1 grid-cols-12 gap-8 px-6 py-8" />
        <ProfileFooter />
      </div>
    </div>
  );
}
