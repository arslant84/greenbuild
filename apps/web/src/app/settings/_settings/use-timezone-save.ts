"use client";

import { meResponseSchema } from "@greenbuild/shared";
import { useState } from "react";
import { lockedUntilFrom } from "./timezone";

export interface TimezoneSave {
  zone: string;
  lockedUntil: string | null;
  saving: boolean;
  failed: boolean;
  change: (zone: string) => Promise<void>;
}

// useTimezoneSave saves a new timezone at once, as the frame has no save button. The API locks the timezone
// for 30 days after a change, and answers a change within them with 409 and the date it unlocks.
export function useTimezoneSave(initial: { timezone: string; timezone_locked_until: string | null }): TimezoneSave {
  const [zone, setZone] = useState(initial.timezone);
  const [lockedUntil, setLockedUntil] = useState(initial.timezone_locked_until);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);

  async function change(next: string): Promise<void> {
    setSaving(true);
    setFailed(false);
    const response = await fetch("/api/me", {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-greenbuild-request": "1" },
      body: JSON.stringify({ timezone: next }),
    }).catch(() => null);
    const body: unknown = await response?.json().catch(() => null);
    setSaving(false);
    const me = meResponseSchema.safeParse(body);
    if (response?.ok && me.success) {
      setZone(me.data.timezone);
      setLockedUntil(me.data.timezone_locked_until);
      return;
    }
    const locked = lockedUntilFrom(body);
    if (locked) {
      setLockedUntil(locked);
      return;
    }
    setFailed(true);
  }

  return { zone, lockedUntil, saving, failed, change };
}
