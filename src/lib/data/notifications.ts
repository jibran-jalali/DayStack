import type { SupabaseClient } from "@supabase/supabase-js";

import { buildSummary, deriveDisplayName } from "@/lib/daystack";
import { syncTaskRemindersForTask } from "@/lib/data/reminders";
import type { Database } from "@/types/database";
import type {
  ParticipantProfile,
  PlannerNotification,
  ProfileRecord,
  TaskNotificationAcceptResult,
  TaskNotificationRecord,
  TaskRecord,
} from "@/types/daystack";

type DayStackClient = SupabaseClient<Database>;

function mapParticipantProfile(profile: Pick<ProfileRecord, "id" | "full_name">): ParticipantProfile {
  return {
    id: profile.id,
    fullName: deriveDisplayName(profile.full_name, undefined),
  };
}

function createNotificationSnapshot(task: Pick<TaskRecord, "end_time" | "id" | "meeting_link" | "start_time" | "task_date" | "task_type" | "title">) {
  return {
    end_time: task.end_time,
    meeting_link: task.meeting_link,
    start_time: task.start_time,
    task_date: task.task_date,
    task_id: task.id,
    task_title: task.title,
    task_type: task.task_type,
  };
}

async function syncAcceptedTaskSummary(client: DayStackClient, userId: string, taskDate: string) {
  const { data: tasks, error: tasksError } = await client
    .from("tasks")
    .select("status, task_type")
    .eq("user_id", userId)
    .eq("task_date", taskDate);

  if (tasksError) {
    throw tasksError;
  }

  const summary = buildSummary((tasks ?? []) as Array<Pick<TaskRecord, "status" | "task_type">>);

  const { error: summaryError } = await client.from("daily_summaries").upsert(
    {
      user_id: userId,
      summary_date: taskDate,
      total_tasks: summary.totalTasks,
      completed_tasks: summary.completedTasks,
      execution_score: summary.executionScore,
      successful_day: summary.successfulDay,
    },
    {
      onConflict: "user_id,summary_date",
    },
  );

  if (summaryError) {
    throw summaryError;
  }
}

export async function fetchTaskNotifications(
  client: DayStackClient,
  userId: string,
  limit = 10,
): Promise<PlannerNotification[]> {
  const { data, error } = await client
    .from("task_notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const notificationRows = (data ?? []) as TaskNotificationRecord[];

  if (notificationRows.length === 0) {
    return [];
  }

  const actorIds = [...new Set(notificationRows.map((notification) => notification.actor_user_id))];
  const acceptedTaskIds = [
    ...new Set(
      notificationRows
        .map((notification) => notification.accepted_task_id)
        .filter((taskId): taskId is string => Boolean(taskId)),
    ),
  ];

  const [{ data: profiles, error: profilesError }, { data: acceptedTasks, error: acceptedTasksError }] =
    await Promise.all([
      client.from("profiles").select("id, full_name").in("id", actorIds),
      acceptedTaskIds.length > 0
        ? client.from("tasks").select("id, task_date").in("id", acceptedTaskIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (profilesError) {
    throw profilesError;
  }

  if (acceptedTasksError) {
    throw acceptedTasksError;
  }

  const actorsById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      mapParticipantProfile(profile as Pick<ProfileRecord, "id" | "full_name">),
    ]),
  );
  const acceptedTaskDatesById = new Map(
    ((acceptedTasks ?? []) as Array<Pick<TaskRecord, "id" | "task_date">>).map((task) => [task.id, task.task_date]),
  );

  return notificationRows
    .map(
      (notification) =>
        ({
          acceptedTaskDate: notification.accepted_task_id
            ? acceptedTaskDatesById.get(notification.accepted_task_id) ?? notification.task_date
            : null,
          acceptedTaskId: notification.accepted_task_id,
          actor: actorsById.get(notification.actor_user_id) ?? null,
          actorId: notification.actor_user_id,
          createdAt: notification.created_at,
          endTime: notification.end_time,
          id: notification.id,
          meetingLink: notification.meeting_link,
          notificationType: notification.notification_type,
          readAt: notification.read_at,
          startTime: notification.start_time,
          status: notification.status,
          taskDate: notification.task_date,
          taskId: notification.task_id,
          taskTitle: notification.task_title,
          taskType: notification.task_type,
        }) satisfies PlannerNotification,
    )
    .sort((left, right) => {
      const leftUnread = left.readAt ? 0 : 1;
      const rightUnread = right.readAt ? 0 : 1;

      if (leftUnread !== rightUnread) {
        return rightUnread - leftUnread;
      }

      const leftPending = left.status === "pending" ? 1 : 0;
      const rightPending = right.status === "pending" ? 1 : 0;

      if (leftPending !== rightPending) {
        return rightPending - leftPending;
      }

      return right.createdAt.localeCompare(left.createdAt);
    });
}

export async function markTaskNotificationsRead(client: DayStackClient, notificationIds: string[]) {
  const uniqueIds = [...new Set(notificationIds)];

  if (uniqueIds.length === 0) {
    return 0;
  }

  const { data, error } = await client.rpc("mark_task_notifications_read", {
    p_notification_ids: uniqueIds,
  });

  if (error) {
    throw error;
  }

  return data ?? 0;
}

export async function syncTaskMentionNotifications(
  client: DayStackClient,
  actorUserId: string,
  task: Pick<TaskRecord, "end_time" | "id" | "meeting_link" | "start_time" | "task_date" | "task_type" | "title">,
  participantIds: string[],
) {
  const { data, error } = await client
    .from("task_notifications")
    .select("*")
    .eq("task_id", task.id)
    .eq("notification_type", "task_mention");

  if (error) {
    throw error;
  }

  const existingRows = (data ?? []) as TaskNotificationRecord[];
  const nextRecipientIds = [...new Set(participantIds.filter((participantId) => participantId !== actorUserId))];
  const nextRecipientIdSet = new Set(nextRecipientIds);
  const acceptedRows = existingRows.filter(
    (notification) => notification.status === "accepted" && nextRecipientIdSet.has(notification.user_id),
  );
  const upsertRows = nextRecipientIds
    .filter((recipientId) => !acceptedRows.some((notification) => notification.user_id === recipientId))
    .map((recipientId) => ({
      actor_user_id: actorUserId,
      notification_type: "task_mention" as const,
      read_at: null,
      status: "pending" as const,
      user_id: recipientId,
      ...createNotificationSnapshot(task),
    }));

  if (upsertRows.length > 0) {
    const { error: upsertError } = await client.from("task_notifications").upsert(upsertRows, {
      onConflict: "task_id,user_id,notification_type",
    });

    if (upsertError) {
      throw upsertError;
    }
  }

  if (acceptedRows.length > 0) {
    const { error: acceptedUpdateError } = await client
      .from("task_notifications")
      .update({
        actor_user_id: actorUserId,
        ...createNotificationSnapshot(task),
      })
      .in(
        "id",
        acceptedRows.map((notification) => notification.id),
      );

    if (acceptedUpdateError) {
      throw acceptedUpdateError;
    }
  }

  const dismissedIds = existingRows
    .filter((notification) => notification.status === "pending" && !nextRecipientIdSet.has(notification.user_id))
    .map((notification) => notification.id);

  if (dismissedIds.length > 0) {
    const { error: dismissError } = await client
      .from("task_notifications")
      .update({
        read_at: new Date().toISOString(),
        status: "dismissed",
      })
      .in("id", dismissedIds);

    if (dismissError) {
      throw dismissError;
    }
  }
}

export async function expireTaskMentionNotifications(client: DayStackClient, actorUserId: string, taskId: string) {
  const { error } = await client
    .from("task_notifications")
    .update({
      read_at: new Date().toISOString(),
      status: "expired",
    })
    .eq("task_id", taskId)
    .eq("actor_user_id", actorUserId)
    .eq("status", "pending");

  if (error) {
    throw error;
  }
}

export async function acceptTaskNotification(
  client: DayStackClient,
  userId: string,
  notificationId: string,
): Promise<TaskNotificationAcceptResult> {
  const { data, error } = await client.rpc("accept_task_notification", {
    p_notification_id: notificationId,
  });

  if (error) {
    throw error;
  }

  const resultRow = Array.isArray(data) ? data[0] : data;

  if (!resultRow) {
    throw new Error("The task mention could not be accepted.");
  }

  if (
    resultRow.outcome !== "accepted" &&
    resultRow.outcome !== "already_accepted" &&
    resultRow.outcome !== "task_missing"
  ) {
    throw new Error("The task mention returned an unexpected result.");
  }

  const result: TaskNotificationAcceptResult = {
    acceptedTaskId: resultRow.accepted_task_id,
    outcome: resultRow.outcome,
    taskDate: resultRow.task_date,
  };

  if (!result.acceptedTaskId) {
    return result;
  }

  const { data: acceptedTaskRow, error: acceptedTaskError } = await client
    .from("tasks")
    .select("*")
    .eq("id", result.acceptedTaskId)
    .eq("user_id", userId)
    .single();

  if (acceptedTaskError) {
    throw acceptedTaskError;
  }

  const acceptedTask = acceptedTaskRow as TaskRecord;

  await Promise.all([
    syncTaskRemindersForTask(client, userId, acceptedTask),
    syncAcceptedTaskSummary(client, userId, acceptedTask.task_date),
  ]);

  return result;
}
