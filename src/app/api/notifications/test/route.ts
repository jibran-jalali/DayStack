import { NextResponse } from "next/server";

import { fetchNotificationPreferences } from "@/lib/data/reminders";
import { sendOneSignalNotification, isOneSignalServerConfigured } from "@/lib/onesignal/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!isOneSignalServerConfigured()) {
    return NextResponse.json(
      {
        error: "Add NEXT_PUBLIC_ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY before sending test notifications.",
      },
      { status: 503 },
    );
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      {
        error: "Supabase is not configured.",
      },
      { status: 503 },
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Sign in before sending a test notification.",
      },
      { status: 401 },
    );
  }

  const preferences = await fetchNotificationPreferences(supabase, user.id);

  if (!preferences.push_enabled) {
    return NextResponse.json(
      {
        error: "Enable reminders on this browser before sending a test notification.",
      },
      { status: 400 },
    );
  }

  await sendOneSignalNotification({
    body: "Your browser is connected and ready for DayStack reminders.",
    externalIds: [user.id],
    heading: "DayStack test notification",
    url: `${new URL(request.url).origin}/app`,
  });

  return NextResponse.json({
    message: "Test notification sent.",
  });
}
