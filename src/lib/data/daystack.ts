import type { SupabaseClient } from "@supabase/supabase-js";

import { syncTaskRemindersForTask } from "@/lib/data/reminders";
import { buildSummary, calculateActiveStreak, deriveDisplayName } from "@/lib/daystack";
import type { Database } from "@/types/database";
import type {
  DailySummaryRecord,
  DashboardSnapshot,
  ParticipantProfile,
  PlannerTask,
  ProfileRecord,
  TaskFormValues,
  TaskParticipantRecord,
  TaskRecord,
} from "@/types/daystack";

type DayStackClient = SupabaseClient<Database>;

function createSummaryPayload(
  userId: string,
  taskDate: string,
  tasks: Array<Pick<TaskRecord, "status">>,
) {
  const summary = buildSummary(tasks);

  return {
    user_id: userId,
    summary_date: taskDate,
    total_tasks: summary.totalTasks,
    completed_tasks: summary.completedTasks,
    execution_score: summary.executionScore,
    successful_day: summary.successfulDay,
  };
}

function mapParticipantProfile(profile: Pick<ProfileRecord, "id" | "full_name">): ParticipantProfile {
  return {
    id: profile.id,
    fullName: deriveDisplayName(profile.full_name, undefined),
  };
}

async function fetchTaskParticipantsForTasks(
  client: DayStackClient,
  taskIds: string[],
): Promise<TaskParticipantRecord[]> {
  if (taskIds.length === 0) {
    return [];
  }

  const { data, error } = await client
    .from("task_participants")
    .select("*")
    .in("task_id", taskIds);

  if (error) {
    throw error;
  }

  return (data ?? []) as TaskParticipantRecord[];
}

async function hydrateTasksWithParticipants(client: DayStackClient, tasks: TaskRecord[]): Promise<PlannerTask[]> {
  if (tasks.length === 0) {
    return [];
  }

  const taskParticipants = await fetchTaskParticipantsForTasks(
    client,
    tasks.map((task) => task.id),
  );

  if (taskParticipants.length === 0) {
    return tasks.map((task) => ({
      ...task,
      participants: [],
    }));
  }

  const participantIds = [...new Set(taskParticipants.map((participant) => participant.participant_id))];

  const { data: profiles, error: profilesError } = await client
    .from("profiles")
    .select("id, full_name")
    .in("id", participantIds);

  if (profilesError) {
    throw profilesError;
  }

  const profilesById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      mapParticipantProfile(profile as Pick<ProfileRecord, "id" | "full_name">),
    ]),
  );

  const participantsByTaskId = taskParticipants.reduce<Map<string, ParticipantProfile[]>>((accumulator, participant) => {
    const profile = profilesById.get(participant.participant_id);

    if (!profile) {
      return accumulator;
    }

    const current = accumulator.get(participant.task_id) ?? [];
    current.push(profile);
    accumulator.set(participant.task_id, current);
    return accumulator;
  }, new Map());

  return tasks.map((task) => ({
    ...task,
    participants: participantsByTaskId.get(task.id) ?? [],
  }));
}

async function replaceTaskParticipants(
  client: DayStackClient,
  taskId: string,
  participantIds: string[],
) {
  const uniqueIds = [...new Set(participantIds)];

  const { error: deleteError } = await client.from("task_participants").delete().eq("task_id", taskId);

  if (deleteError) {
    throw deleteError;
  }

  if (uniqueIds.length === 0) {
    return;
  }

  const { error: insertError } = await client.from("task_participants").insert(
    uniqueIds.map((participantId) => ({
      task_id: taskId,
      participant_id: participantId,
    })),
  );

  if (insertError) {
    throw insertError;
  }
}

async function fetchTaskRowsForDate(
  client: DayStackClient,
  userId: string,
  taskDate: string,
): Promise<TaskRecord[]> {
  const { data, error } = await client
    .from("tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("task_date", taskDate)
    .order("start_time", { ascending: true })
    .order("end_time", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []) as TaskRecord[];
}

export async function fetchTasksForDate(
  client: DayStackClient,
  userId: string,
  taskDate: string,
): Promise<PlannerTask[]> {
  const rows = await fetchTaskRowsForDate(client, userId, taskDate);
  return hydrateTasksWithParticipants(client, rows);
}

export async function fetchRecentSummaries(
  client: DayStackClient,
  userId: string,
  limit = 45,
): Promise<DailySummaryRecord[]> {
  const { data, error } = await client
    .from("daily_summaries")
    .select("*")
    .eq("user_id", userId)
    .order("summary_date", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []) as DailySummaryRecord[];
}

export async function fetchProfile(client: DayStackClient, userId: string): Promise<ProfileRecord | null> {
  const { data, error } = await client
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data ?? null) as ProfileRecord | null;
}

export async function syncDailySummaryForDate(
  client: DayStackClient,
  userId: string,
  taskDate: string,
): Promise<DailySummaryRecord> {
  const tasks = await fetchTaskRowsForDate(client, userId, taskDate);
  const payload = createSummaryPayload(userId, taskDate, tasks);

  const { data, error } = await client
    .from("daily_summaries")
    .upsert(payload, {
      onConflict: "user_id,summary_date",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data as DailySummaryRecord;
}

export async function fetchDashboardSnapshot(
  client: DayStackClient,
  userId: string,
  taskDate: string,
): Promise<DashboardSnapshot> {
  const [tasks, persistedSummary, recentSummaries] = await Promise.all([
    fetchTasksForDate(client, userId, taskDate),
    client
      .from("daily_summaries")
      .select("*")
      .eq("user_id", userId)
      .eq("summary_date", taskDate)
      .maybeSingle(),
    fetchRecentSummaries(client, userId),
  ]);

  if (persistedSummary.error) {
    throw persistedSummary.error;
  }

  const summary = buildSummary(tasks);
  const liveSummary = (persistedSummary.data ?? {
    id: `live-${taskDate}`,
    user_id: userId,
    summary_date: taskDate,
    total_tasks: summary.totalTasks,
    completed_tasks: summary.completedTasks,
    execution_score: summary.executionScore,
    successful_day: summary.successfulDay,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }) as DailySummaryRecord;

  const mergedSummaries = [liveSummary, ...recentSummaries.filter((item) => item.summary_date !== taskDate)] as DailySummaryRecord[];

  return {
    taskDate,
    tasks,
    recentSummaries: mergedSummaries,
    summary,
    streak: calculateActiveStreak(mergedSummaries, taskDate),
  } as DashboardSnapshot;
}

export async function createTask(
  client: DayStackClient,
  userId: string,
  values: TaskFormValues,
): Promise<TaskRecord> {
  const { data, error } = await client
    .from("tasks")
    .insert({
      user_id: userId,
      title: values.title,
      task_date: values.taskDate,
      start_time: values.startTime,
      end_time: values.endTime,
      task_type: values.taskType,
      meeting_link: values.taskType === "meeting" ? values.meetingLink || null : null,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const createdTask = data as TaskRecord;

  await replaceTaskParticipants(
    client,
    createdTask.id,
    values.taskType === "meeting" ? values.participants.map((participant) => participant.id) : [],
  );
  await syncTaskRemindersForTask(client, userId, createdTask);
  await syncDailySummaryForDate(client, userId, values.taskDate);

  return createdTask;
}

export async function updateTask(
  client: DayStackClient,
  userId: string,
  taskId: string,
  values: TaskFormValues,
): Promise<TaskRecord> {
  const { data: existingTask, error: existingTaskError } = await client
    .from("tasks")
    .select("task_date")
    .eq("id", taskId)
    .eq("user_id", userId)
    .single();

  if (existingTaskError) {
    throw existingTaskError;
  }

  const { data, error } = await client
    .from("tasks")
    .update({
      title: values.title,
      task_date: values.taskDate,
      start_time: values.startTime,
      end_time: values.endTime,
      task_type: values.taskType,
      meeting_link: values.taskType === "meeting" ? values.meetingLink || null : null,
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const updatedTask = data as TaskRecord;

  await replaceTaskParticipants(
    client,
    taskId,
    values.taskType === "meeting" ? values.participants.map((participant) => participant.id) : [],
  );
  await syncTaskRemindersForTask(client, userId, updatedTask);

  if (existingTask.task_date !== values.taskDate) {
    await Promise.all([
      syncDailySummaryForDate(client, userId, existingTask.task_date),
      syncDailySummaryForDate(client, userId, values.taskDate),
    ]);
  } else {
    await syncDailySummaryForDate(client, userId, values.taskDate);
  }

  return updatedTask;
}

export async function deleteTask(client: DayStackClient, userId: string, taskId: string): Promise<string> {
  const { data, error } = await client
    .from("tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId)
    .select("task_date")
    .single();

  if (error) {
    throw error;
  }

  const deletedTask = data as { task_date: string };

  await syncDailySummaryForDate(client, userId, deletedTask.task_date);

  return deletedTask.task_date;
}

export async function toggleTaskStatus(
  client: DayStackClient,
  userId: string,
  taskId: string,
  status: "pending" | "completed",
): Promise<TaskRecord> {
  const { data, error } = await client
    .from("tasks")
    .update({
      status,
    })
    .eq("id", taskId)
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  const nextTask = data as TaskRecord;

  await syncTaskRemindersForTask(client, userId, nextTask);
  await syncDailySummaryForDate(client, userId, nextTask.task_date);

  return nextTask;
}

export async function searchProfiles(
  client: DayStackClient,
  query: string,
  options?: {
    excludeUserId?: string;
    limit?: number;
  },
): Promise<ParticipantProfile[]> {
  let request = client.from("profiles").select("id, full_name");

  if (options?.excludeUserId) {
    request = request.neq("id", options.excludeUserId);
  }

  const normalizedQuery = query.trim();

  if (normalizedQuery.length > 0) {
    request = request.ilike("full_name", `%${normalizedQuery}%`);
  }

  const { data, error } = await request
    .order("full_name", { ascending: true })
    .limit(options?.limit ?? 6);

  if (error) {
    throw error;
  }

  return (data ?? []).map((profile) => mapParticipantProfile(profile as Pick<ProfileRecord, "id" | "full_name">));
}
