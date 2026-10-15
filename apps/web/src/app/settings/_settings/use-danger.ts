"use client";

import { deletionResponseSchema } from "@greenbuild/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type DangerModal = "none" | "export" | "delete";

export interface Danger {
  modal: DangerModal;
  open: (modal: DangerModal) => void;
  busy: boolean;
  error: string | null;
  requestExport: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const WRITE = { "x-greenbuild-request": "1" };

// useDanger runs the Danger Zone's two actions: an export request (POST /api/me/export, then the frame's
// "Data Export Initiated" modal) and the account deletion (DELETE /api/me, then back to the landing page).
export function useDanger(): Danger {
  const router = useRouter();
  const [modal, setModal] = useState<DangerModal>("none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requestExport(): Promise<void> {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/me/export", { method: "POST", headers: WRITE }).catch(() => null);
    setBusy(false);
    if (response?.ok) {
      setModal("export");
      return;
    }
    setError("Your export was not requested. Try again.");
  }

  async function deleteAccount(): Promise<void> {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/me", { method: "DELETE", headers: WRITE }).catch(() => null);
    const deleted = deletionResponseSchema.safeParse(await response?.json().catch(() => null));
    setBusy(false);
    if (response?.ok && deleted.success) {
      router.push("/");
      return;
    }
    setError("Your account was not deleted. Try again.");
  }

  return {
    modal,
    open: (next) => {
      setError(null);
      setModal(next);
    },
    busy,
    error,
    requestExport,
    deleteAccount,
  };
}
