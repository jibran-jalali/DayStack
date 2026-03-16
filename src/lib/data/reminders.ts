import type { SupabaseClient } from "@supabase/supabase-js";

import { formatClockTime, formatDateKey } from "@/lib/daystack";
import type { Database } from "@/types/database";
import type {
  DueTaskReminder,
  ReminderStatus,
  ReminderType,
  TaskRecord,
  TaskReminderRecord,
  UserNotificationPreferencesRecord,
} from "@/types/daystack";

type DayStackClient = SupabaseClient<Database>;

const DEFAULT_REMINDER_PREFERENCES = {
  push_enabled: false,
  remind_5_min_before: true,
  remind_at_start: true,
  remind_overdue: false,
} as const;

const MUTABLE_REMINDER_STATUSES: ReminderStatus[] = ["failed", "pending", "processing", "skipped"];

function createDefaultPreferences(userId: string): UserNotificationPreferencesRecord {
  const nowIso = new Date().toISOString();

  return {
    user_id: userId,
    ...DEFAULT_REMINDER_PREFERENCES,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

function buildReminderTimestamp(taskDate: string, time: string, offsetMinutes = 0) {
  const localDate = new Date(`${taskDate}T${time}`);

  if (Number.isNaN(localDate.getTime())) {
    throw new Error("Unable to schedule the reminder for this task.");
  }

  localDate.setMinutes(localDate.getMinutes() + offsetMinutes);

  return localDate.toISOString();
}

function getReminderRowsForTask(
  userId: string,
  task: Pick<TaskRecord, "end_time" | "id" | "start_time" | "status" | "task_date">,
  preferences: UserNotificationPreferencesRecord,
) {
  if (!preferences.push_enabled || task.status !== "pending") {
    return [];
  }

  const rows: Array<Database["public"]["Tables"]["task_reminders"]["Insert"]> = [];

  if (preferences.remind_5_min_before) {
    rows.push({
      user_id: userId,
      task_id: task.id,
      reminder_type: "5_minutes_before",
      remind_at: buildReminderTimestamp(task.task_date, task.start_time, -5),
      status: "pending",
    });
  }

  if (preferences.remind_at_start) {
    rows.push({
      user_id: userId,
      task_id: task.id,
      reminder_type: "at_start",
      remind_at: buildReminderTimestamp(task.task_date, task.start_time),
      status: "pending",
    });
  }

  if (preferences.remind_overdue) {
    rows.push({
      user_id: userId,
      task_id: task.id,
      reminder_type: "overdue",
      remind_at: buildReminderTimestamp(task.task_date, task.end_time),
      status: "pending",
    });
  }

  return rows;
}

export async function fetchNotificationPreferences(
  client: DayStackClient,
  userId: string,
): Promise<UserNotificationPreferencesRecord> {
  const { data, error } = await client
    .from("user_notification_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? createDefaultPreferences(userId)) as UserNotificationPreferencesRecord;
}

async function fetchPendingTasksForReminderSync(
  client: DayStackClient,
  userId: string,
  fromDate: string,
): Promise<TaskRecord[]> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .gte("task_date", fromDate)
    .order("task_date", { ascending: true })
    .order("start_time", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as TaskRecord[];
}

export async function syncTaskRemindersForTask(
  client: DayStackClient,
  userId: string,
  task: Pick<TaskRecord, "end_time" | "id" | "start_time" | "status" | "task_date">,
  preferences?: UserNotificationPreferencesRecord,
) {
  const activePreferences = preferences ?? (await fetchNotificationPreferences(client, userId));

  const { error: deleteError } = await client
    .from("task_reminders")
    .delete()
    .eq("task_id", task.id)
    .in("status", MUTABLE_REMINDER_STATUSES);

  if (deleteError) {
    throw deleteError;
  }

  const reminderRows = getReminderRowsForTask(userId, task, activePreferences);

  if (reminderRows.length === 0) {
    return;
  }

  const { error: insertError } = await client.from("task_reminders").insert(reminderRows);

  if (insertError) {
    throw insertError;
  }
}

export async function syncTaskRemindersForUser(
  client: DayStackClient,
  userId: string,
  preferences?: UserNotificationPreferencesRecord,
  now = new Date(),
) {
  const activePreferences = preferences ?? (await fetchNotificationPreferences(client, userId));
  const tasks = await fetchPendingTasksForReminderSync(client, userId, formatDateKey(now));

  if (tasks.length === 0) {
    return activePreferences;
  }

  await Promise.all(tasks.map((task) => syncTaskRemindersForTask(client, userId, task, activePreferences)));

  return activePreferences;
}

export async function updateNotificationPreferences(
  client: DayStackClient,
  userId: string,
  updates: Partial<
    Pick<
      UserNotificationPreferencesRecord,
      "push_enabled" | "remind_5_min_before" | "remind_at_start" | "remind_overdue"
    >
  >,
  now = new Date(),
): Promise<UserNotificationPreferencesRecord> {
  const current = await fetchNotificationPreferences(client, userId);
  const nextPreferences = {
    user_id: userId,
    push_enabled: updates.push_enabled ?? current.push_enabled,
    remind_5_min_before: updates.remind_5_min_before ?? current.remind_5_min_before,
    remind_at_start: updates.remind_at_start ?? current.remind_at_start,
    remind_overdue: updates.remind_overdue ?? current.remind_overdue,
  };

  const { data, error } = await client
    .from("user_notification_preferences")
    .upsert(nextPreferences, {
      onConflict: "user_id",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const savedPreferences = data as UserNotificationPreferencesRecord;

  await syncTaskRemindersForUser(client, userId, savedPreferences, now);

  return savedPreferences;
}

export async function fetchDueTaskReminders(
  client: DayStackClient,
  options?: {
    limit?: number;
    nowIso?: string;
    userId?: string;
  },
): Promise<DueTaskReminder[]> {
  let reminderQuery = client
    .from("task_reminders")
    .select("*")
    .eq("status", "pending")
    .lte("remind_at", options?.nowIso ?? new Date().toISOString())
    .order("remind_at", { ascending: true })
    .limit(options?.limit ?? 25);

  if (options?.userId) {
    reminderQuery = reminderQuery.eq("user_id", options.userId);
  }

  const { data: reminders, error: remindersError } = await reminderQuery;

  if (remindersError) {
    throw remindersError;
  }

  const reminderRows = (reminders ?? []) as TaskReminderRecord[];

  if (reminderRows.length === 0) {
    return [];
  }

  const taskIds = [...new Set(reminderRows.map((reminder) => reminder.task_id))];
  const userIds = [...new Set(reminderRows.map((reminder) => reminder.user_id))];

  const [{ data: tasks, error: tasksError }, { data: preferences, error: preferencesError }] = await Promise.all([
    client.from("tasks").select("id, user_id, title, task_date, start_time, end_time, status, task_type, meeting_link").in("id", taskIds),
    client
      .from("user_notification_preferences")
      .select("*")
      .in("user_id", userIds),
  ]);

  if (tasksError) {
    throw tasksError;
  }

  if (preferencesError) {
    throw preferencesError;
  }

  const tasksById = new Map(
    ((tasks ?? []) as Array<
      Pick<
        TaskRecord,
        "end_time" | "id" | "meeting_link" | "start_time" | "status" | "task_date" | "task_type" | "title" | "user_id"
      >
    >).map((task) => [task.id, task]),
  );

  const preferencesByUserId = new Map(
    ((preferences ?? []) as UserNotificationPreferencesRecord[]).map((preference) => [preference.user_id, preference]),
  );

  return reminderRows.flatMap((reminder) => {
    const task = tasksById.get(reminder.task_id);
    const preference = preferencesByUserId.get(reminder.user_id) ?? createDefaultPreferences(reminder.user_id);

    if (!task) {
      return [];
    }

    return [
      {
        reminder,
        task,
        preferences: preference,
      },
    ];
  });
}

export async function updateTaskReminderStatus(
  client: DayStackClient,
  reminderId: string,
  status: ReminderStatus,
  options?: {
    sentAt?: string | null;
    userId?: string;
  },
) {
  let request = client
    .from("task_reminders")
    .update({
      status,
      sent_at: options?.sentAt ?? null,
    })
    .eq("id", reminderId);

  if (options?.userId) {
    request = request.eq("user_id", options.userId);
  }

  const { error } = await request;

  if (error) {
    throw error;
  }
}

export function buildReminderCopy(task: Pick<TaskRecord, "end_time" | "start_time" | "title">, reminderType: ReminderType) {
  if (reminderType === "5_minutes_before") {
    return {
      title: "Starting in 5 minutes",
      body: `${task.title} begins at ${formatClockTime(task.start_time)}.`,
    };
  }

  if (reminderType === "at_start") {
    return {
      title: "Time to begin",
      body: `${task.title} starts now.`,
    };
  }

  return {
    title: "Block still open",
    body: `${task.title} was planned to end at ${formatClockTime(task.end_time)}.`,
  };
}
