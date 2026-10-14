"use client";

import { errorResponseSchema, meResponseSchema } from "@greenbuild/shared";
import { useState } from "react";
import { isDirty, type ProfileFields, profileChanges, profileFields, saveError } from "./profile-form";

export type SaveStatus = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "failed"; message: string };

export interface ProfileSave {
  edited: ProfileFields;
  edit: (changes: Partial<ProfileFields>) => void;
  dirty: boolean;
  status: SaveStatus;
  save: () => Promise<void>;
  reset: () => void;
}

// useProfileSave keeps the Profile form: what was loaded, what the player typed, and the save's state.
export function useProfileSave(initial: ProfileFields): ProfileSave {
  const [loaded, setLoaded] = useState(initial);
  const [edited, setEdited] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });

  async function save(): Promise<void> {
    setStatus({ kind: "saving" });
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-greenbuild-request": "1" },
      body: JSON.stringify(profileChanges(loaded, edited)),
    }).catch(() => null);
    const body: unknown = await response?.json().catch(() => null);
    const me = meResponseSchema.safeParse(body);
    if (response?.ok && me.success) {
      const saved = profileFields(me.data);
      setLoaded(saved);
      setEdited(saved);
      setStatus({ kind: "saved" });
      return;
    }
    const error = errorResponseSchema.safeParse(body);
    setStatus({ kind: "failed", message: saveError(error.success ? error.data : null) });
  }

  return {
    edited,
    edit: (changes) => setEdited({ ...edited, ...changes }),
    dirty: isDirty(loaded, edited),
    status,
    save,
    reset: () => {
      setEdited(loaded);
      setStatus({ kind: "idle" });
    },
  };
}
