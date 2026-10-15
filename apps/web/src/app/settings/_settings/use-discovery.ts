"use client";

import { type DiscoveryResponse, discoveryResponseSchema, errorResponseSchema } from "@greenbuild/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { discoveryError, discoveryRequest } from "./discovery";

export interface DiscoverySave {
  discovery: DiscoveryResponse;
  confirmed18: boolean;
  setConfirmed18: (confirmed: boolean) => void;
  saving: boolean;
  error: string | null;
  toggle: (on: boolean) => Promise<void>;
}

// useDiscovery moves the Open to Offers switch through PUT /api/me/discovery, then refreshes the page so its
// consent history shows the grant or the revocation.
export function useDiscovery(initial: DiscoveryResponse): DiscoverySave {
  const router = useRouter();
  const [discovery, setDiscovery] = useState(initial);
  const [confirmed18, setConfirmed18] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(on: boolean): Promise<void> {
    setSaving(true);
    setError(null);
    const response = await fetch("/api/me/discovery", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-greenbuild-request": "1" },
      body: JSON.stringify(discoveryRequest(on, confirmed18)),
    }).catch(() => null);
    const body: unknown = await response?.json().catch(() => null);
    setSaving(false);
    const saved = discoveryResponseSchema.safeParse(body);
    if (response?.ok && saved.success) {
      setDiscovery(saved.data);
      router.refresh();
      return;
    }
    const failure = errorResponseSchema.safeParse(body);
    setError(discoveryError(failure.success ? failure.data : null));
  }

  return { discovery, confirmed18, setConfirmed18, saving, error, toggle };
}
