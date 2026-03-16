"use client";

import { useEffect, useEffectEvent, useState, useTransition } from "react";

import { updateNotificationPreferences } from "@/lib/data/reminders";
import {
  disableOneSignalPush,
  enableOneSignalPush,
  getOneSignalState,
  loginOneSignalUser,
  observeOneSignalState,
} from "@/lib/onesignal/client";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getErrorMessage } from "@/lib/utils";
import type { OneSignalSubscriptionState, UserNotificationPreferencesRecord } from "@/types/daystack";

function createDefaultNotificationState(): OneSignalSubscriptionState {
  return {
    configured: Boolean(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim()),
    permissionGranted: false,
    ready: false,
    supported: false,
    subscribed: false,
    subscriptionId: null,
  };
}

interface UseNotificationSettingsOptions {
  initialPreferences: UserNotificationPreferencesRecord;
  onNotice?: (notice: { message: string; type: "error" | "success" }) => void;
  userId: string;
}

export function useNotificationSettings({
  initialPreferences,
  onNotice,
  userId,
}: UseNotificationSettingsOptions) {
  const [notificationPreferences, setNotificationPreferences] = useState(initialPreferences);
  const [notificationState, setNotificationState] = useState<OneSignalSubscriptionState>(
    createDefaultNotificationState(),
  );
  const [isPending, startTransition] = useTransition();

  const syncPushEnabledPreference = useEffectEvent(async (subscribed: boolean) => {
    if (notificationPreferences.push_enabled === subscribed) {
      return;
    }

    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      return;
    }

    try {
      const nextPreferences = await updateNotificationPreferences(supabase, userId, {
        push_enabled: subscribed,
      });
      setNotificationPreferences(nextPreferences);
    } catch {
      return;
    }
  });

  const syncOneSignalState = useEffectEvent(async (nextState: OneSignalSubscriptionState) => {
    setNotificationState(nextState);

    if (!nextState.configured || !nextState.ready || !nextState.supported) {
      return;
    }

    await syncPushEnabledPreference(nextState.subscribed);
  });

  useEffect(() => {
    let unsubscribe: () => void = () => {};

    void (async () => {
      try {
        const state = await loginOneSignalUser(userId);
        await syncOneSignalState(state);

        unsubscribe = await observeOneSignalState((nextState) => {
          void syncOneSignalState(nextState);
        });
      } catch {
        const fallbackState = await getOneSignalState().catch(() => createDefaultNotificationState());
        setNotificationState(fallbackState);
      }
    })();

    return () => {
      unsubscribe();
    };
  }, [userId]);

  function toggleReminderSetting(
    key: "remind_5_min_before" | "remind_at_start" | "remind_overdue",
    nextValue: boolean,
  ) {
    const supabase = createSupabaseBrowserClient();

    if (!supabase) {
      onNotice?.({
        type: "error",
        message: "Add your Supabase environment variables before changing reminders.",
      });
      return;
    }

    startTransition(async () => {
      try {
        const nextPreferences = await updateNotificationPreferences(supabase, userId, {
          [key]: nextValue,
        });
        setNotificationPreferences(nextPreferences);
        onNotice?.({
          type: "success",
          message: "Reminder settings updated.",
        });
      } catch (error) {
        onNotice?.({
          type: "error",
          message: getErrorMessage(error),
        });
      }
    });
  }

  function togglePushReminders(nextValue: boolean) {
    startTransition(async () => {
      try {
        const supabase = createSupabaseBrowserClient();

        if (!supabase) {
          throw new Error("Add your Supabase environment variables before changing reminders.");
        }

        const nextState = nextValue ? await enableOneSignalPush() : await disableOneSignalPush();
        setNotificationState(nextState);

        if (!nextState.configured) {
          throw new Error("Add your OneSignal app ID before enabling reminders.");
        }

        if (nextValue && !nextState.supported) {
          throw new Error("This browser does not support web push notifications.");
        }

        if (nextValue && !nextState.subscribed) {
          throw new Error("Push permission was not granted for this browser.");
        }

        const nextPreferences = await updateNotificationPreferences(supabase, userId, {
          push_enabled: nextValue ? nextState.subscribed : false,
        });

        setNotificationPreferences(nextPreferences);
        onNotice?.({
          type: "success",
          message: nextValue ? "Reminders enabled on this browser." : "Reminders paused for this browser.",
        });
      } catch (error) {
        onNotice?.({
          type: "error",
          message: getErrorMessage(error),
        });
      }
    });
  }

  function sendTestNotification() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/notifications/test", {
          method: "POST",
        });

        const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

        if (!response.ok) {
          throw new Error(payload?.error ?? "The test notification could not be sent.");
        }

        onNotice?.({
          type: "success",
          message: payload?.message ?? "Test notification sent.",
        });
      } catch (error) {
        onNotice?.({
          type: "error",
          message: getErrorMessage(error),
        });
      }
    });
  }

  return {
    isNotificationPending: isPending,
    notificationPreferences,
    notificationState,
    sendTestNotification,
    setNotificationPreferences,
    togglePushReminders,
    toggleReminderSetting,
  };
}
