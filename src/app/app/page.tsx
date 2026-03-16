import { PlannerShell } from "@/components/app/planner-shell";
import { SetupNotice } from "@/components/shared/setup-notice";
import { fetchDashboardSnapshot, fetchProfile } from "@/lib/data/daystack";
import { fetchNotificationPreferences } from "@/lib/data/reminders";
import { deriveDisplayName, formatDateKey, isValidDateKey } from "@/lib/daystack";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";

function isSchemaMissingError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { code?: string; message?: string };

  return (
    maybeError.code === "PGRST205" ||
    maybeError.code === "PGRST204" ||
    maybeError.message?.includes("Could not find the table") === true ||
    maybeError.message?.includes("Could not find the column") === true
  );
}

interface AppPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AppPage({ searchParams }: AppPageProps) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return (
      <main className="container-shell min-h-screen py-10">
        <SetupNotice />
      </main>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const requestedDate = Array.isArray(resolvedSearchParams.date)
    ? resolvedSearchParams.date[0]
    : resolvedSearchParams.date;
  const taskDate = requestedDate && isValidDateKey(requestedDate) ? requestedDate : formatDateKey(new Date());

  try {
    const [snapshot, profile, notificationPreferences] = await Promise.all([
      fetchDashboardSnapshot(supabase, user.id, taskDate),
      fetchProfile(supabase, user.id),
      fetchNotificationPreferences(supabase, user.id),
    ]);

    const metadata = user.user_metadata as { full_name?: string | null } | undefined;

    return (
      <PlannerShell
        userId={user.id}
        email={user.email}
        displayName={deriveDisplayName(profile?.full_name ?? metadata?.full_name, user.email)}
        initialSnapshot={snapshot}
        initialNotificationPreferences={notificationPreferences}
      />
    );
  } catch (error) {
    console.error("DayStack dashboard bootstrap failed:", error);

    if (isSchemaMissingError(error)) {
      return (
        <main className="container-shell min-h-screen py-10">
          <SetupNotice
            showAction={false}
            eyebrow="Database schema missing"
            title="Your Supabase credentials are loaded, but DayStack's tables are not in this project yet."
            description={
              <>
                Run the SQL in <code>supabase/schema.sql</code> inside your Supabase SQL editor. The dashboard
                needs <code>profiles</code>, <code>tasks</code>, <code>task_participants</code>,{" "}
                <code>daily_summaries</code>, <code>user_notification_preferences</code>, and{" "}
                <code>task_reminders</code> before it can load live data.
              </>
            }
          />
        </main>
      );
    }

    return (
      <main className="container-shell min-h-screen py-10">
        <SetupNotice
          showAction={false}
          eyebrow="Dashboard load failed"
          title="DayStack reached Supabase, but the dashboard data could not be loaded."
          description="Check the terminal for the server-side error details, then retry the page."
        />
      </main>
    );
  }
}
