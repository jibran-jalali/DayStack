interface SendOneSignalNotificationInput {
  body: string;
  data?: Record<string, unknown>;
  externalIds: string[];
  heading: string;
  url: string;
}

export function isOneSignalServerConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim() && process.env.ONESIGNAL_REST_API_KEY?.trim(),
  );
}

export async function sendOneSignalNotification({
  body,
  data,
  externalIds,
  heading,
  url,
}: SendOneSignalNotificationInput) {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim();
  const restApiKey = process.env.ONESIGNAL_REST_API_KEY?.trim();

  if (!appId || !restApiKey) {
    throw new Error("OneSignal is not configured on the server.");
  }

  if (externalIds.length === 0) {
    throw new Error("At least one target user is required to send a notification.");
  }

  const response = await fetch("https://api.onesignal.com/notifications?c=push", {
    method: "POST",
    headers: {
      Authorization: `Key ${restApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_id: appId,
      contents: {
        en: body,
      },
      data,
      headings: {
        en: heading,
      },
      include_aliases: {
        external_id: externalIds,
      },
      target_channel: "push",
      url,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof payload?.errors?.[0] === "string"
        ? payload.errors[0]
        : payload?.errors
          ? JSON.stringify(payload.errors)
          : "The OneSignal API rejected the notification request.";

    throw new Error(message);
  }

  return payload;
}
