"use client";

import { deletionResponseSchema } from "@greenbuild/shared";
import { signOut } from "next-auth/react";
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
// "Data Export Initiated" modal) and the account deletion (DELETE /api/me, then signed out on the landing page:
// a closed account cannot sign in again, and the landing sends a signed-in player on to /play).
export function useDanger(): Danger {
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
      await signOut({ redirectTo: "/" });
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
