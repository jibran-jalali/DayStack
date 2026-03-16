"use client";

import { useEffect } from "react";

import { loginOneSignalUser } from "@/lib/onesignal/client";

interface NotificationBridgeProps {
  userId: string;
}

export function NotificationBridge({ userId }: NotificationBridgeProps) {
  useEffect(() => {
    void loginOneSignalUser(userId).catch(() => undefined);
  }, [userId]);

  return null;
}
