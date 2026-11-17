"use client";

import { meResponseSchema } from "@greenbuild/shared";
import { useState } from "react";

export interface VisibilitySave {
  isPublic: boolean;
  saving: boolean;
  failed: boolean;
  save: (isPublic: boolean) => Promise<void>;
}

// useVisibility saves whether the game profile is public through PATCH /api/me; the answer is what was saved.
export function useVisibility(initial: boolean): VisibilitySave {
  const [isPublic, setPublic] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function save(next: boolean): Promise<void> {
    setSaving(true);
    setFailed(false);
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-greenbuild-request": "1" },
      body: JSON.stringify({ game_profile_public: next }),
    }).catch(() => null);
    const me = meResponseSchema.safeParse(await response?.json().catch(() => null));
    setSaving(false);
    if (response?.ok && me.success) {
      setPublic(me.data.game_profile_public);
      return;
    }
    setFailed(true);
  }

  return { isPublic, saving, failed, save };
}
