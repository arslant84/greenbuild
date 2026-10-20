"use client";

import { errorResponseSchema, type Notifications, notificationsSchema } from "@greenbuild/shared";
import { useState } from "react";
import { notificationsError } from "./notifications";

export interface NotificationsSave {
  notifications: Notifications;
  saving: boolean;
  error: string | null;
  save: (next: Notifications) => Promise<void>;
}

// useNotifications saves the streak reminder switch and its hour through PUT /api/me/notifications (task 52).
export function useNotifications(initial: Notifications): NotificationsSave {
  const [notifications, setNotifications] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: Notifications): Promise<void> {
    setSaving(true);
    setError(null);
    const response = await fetch("/api/me/notifications", {
      method: "PUT",
      headers: { "content-type": "application/json", "x-greenbuild-request": "1" },
      body: JSON.stringify(next),
    }).catch(() => null);
    const body: unknown = await response?.json().catch(() => null);
    setSaving(false);
    const saved = notificationsSchema.safeParse(body);
    if (response?.ok && saved.success) {
      setNotifications(saved.data);
      return;
    }
    const failure = errorResponseSchema.safeParse(body);
    setError(notificationsError(failure.success ? failure.data : null));
  }

  return { notifications, saving, error, save };
}
