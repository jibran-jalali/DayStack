import { NextResponse } from "next/server";

import {
  buildReminderCopy,
  fetchDueTaskReminders,
  updateTaskReminderStatus,
} from "@/lib/data/reminders";
import { isOneSignalServerConfigured, sendOneSignalNotification } from "@/lib/onesignal/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isOneSignalServerConfigured()) {
    return NextResponse.json(
      {
        error: "OneSignal is not configured on the server.",
      },
      { status: 503 },
    );
  }

  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  const isCronRequest = Boolean(cronSecret && authorization === `Bearer ${cronSecret}`);
  const appUrl = `${new URL(request.url).origin}/app`;

  const serviceClient = createSupabaseServiceClient();

  if (isCronRequest) {
    if (!serviceClient) {
      return NextResponse.json(
        {
          error: "SUPABASE_SERVICE_ROLE_KEY is required for global reminder dispatch.",
        },
        { status: 503 },
      );
    }

    const reminders = await fetchDueTaskReminders(serviceClient, {
      limit: 50,
    });

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const dueReminder of reminders) {
      try {
        await updateTaskReminderStatus(serviceClient, dueReminder.reminder.id, "processing");

        if (!dueReminder.preferences.push_enabled || dueReminder.task.status === "completed") {
          await updateTaskReminderStatus(serviceClient, dueReminder.reminder.id, "skipped");
          skipped += 1;
          continue;
        }

        const copy = buildReminderCopy(dueReminder.task, dueReminder.reminder.reminder_type);

        await sendOneSignalNotification({
          body: copy.body,
          data: {
            reminderId: dueReminder.reminder.id,
            reminderType: dueReminder.reminder.reminder_type,
            taskDate: dueReminder.task.task_date,
            taskId: dueReminder.task.id,
          },
          externalIds: [dueReminder.reminder.user_id],
          heading: copy.title,
          url: appUrl,
        });

        await updateTaskReminderStatus(serviceClient, dueReminder.reminder.id, "sent", {
          sentAt: new Date().toISOString(),
        });
        sent += 1;
      } catch {
        await updateTaskReminderStatus(serviceClient, dueReminder.reminder.id, "failed");
        failed += 1;
      }
    }

    return NextResponse.json({
      failed,
      processed: reminders.length,
      sent,
      skipped,
    });
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
        error: "Sign in before dispatching reminders.",
      },
      { status: 401 },
    );
  }

  const reminders = await fetchDueTaskReminders(supabase, {
    limit: 20,
    userId: user.id,
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const dueReminder of reminders) {
    try {
      await updateTaskReminderStatus(supabase, dueReminder.reminder.id, "processing", {
        userId: user.id,
      });

      if (!dueReminder.preferences.push_enabled || dueReminder.task.status === "completed") {
        await updateTaskReminderStatus(supabase, dueReminder.reminder.id, "skipped", {
          userId: user.id,
        });
        skipped += 1;
        continue;
      }

      const copy = buildReminderCopy(dueReminder.task, dueReminder.reminder.reminder_type);

      await sendOneSignalNotification({
        body: copy.body,
        data: {
          reminderId: dueReminder.reminder.id,
          reminderType: dueReminder.reminder.reminder_type,
          taskDate: dueReminder.task.task_date,
          taskId: dueReminder.task.id,
        },
        externalIds: [dueReminder.reminder.user_id],
        heading: copy.title,
        url: appUrl,
      });

      await updateTaskReminderStatus(supabase, dueReminder.reminder.id, "sent", {
        sentAt: new Date().toISOString(),
        userId: user.id,
      });
      sent += 1;
    } catch {
      await updateTaskReminderStatus(supabase, dueReminder.reminder.id, "failed", {
        userId: user.id,
      });
      failed += 1;
    }
  }

  return NextResponse.json({
    failed,
    processed: reminders.length,
    sent,
    skipped,
  });
}
