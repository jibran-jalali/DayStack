import { SettingsShell } from "@/components/app/settings-shell";
import { SetupNotice } from "@/components/shared/setup-notice";
import { fetchProfile } from "@/lib/data/daystack";
import { fetchNotificationPreferences } from "@/lib/data/reminders";
import { deriveDisplayName, isValidDateKey } from "@/lib/daystack";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Settings",
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

interface SettingsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
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
  const returnDate = requestedDate && isValidDateKey(requestedDate) ? requestedDate : undefined;

  try {
    const [profile, notificationPreferences] = await Promise.all([
      fetchProfile(supabase, user.id),
      fetchNotificationPreferences(supabase, user.id),
    ]);

    const metadata = user.user_metadata as { full_name?: string | null } | undefined;

    return (
      <SettingsShell
        userId={user.id}
        email={user.email}
        displayName={deriveDisplayName(profile?.full_name ?? metadata?.full_name, user.email)}
        initialNotificationPreferences={notificationPreferences}
        returnDate={returnDate}
      />
    );
  } catch (error) {
    console.error("DayStack settings bootstrap failed:", error);

    if (isSchemaMissingError(error)) {
      return (
        <main className="container-shell min-h-screen py-10">
          <SetupNotice
            showAction={false}
            eyebrow="Database schema missing"
            title="Your Supabase credentials are loaded, but DayStack's tables are not in this project yet."
            description={
              <>
                Run the SQL in <code>supabase/schema.sql</code> inside your Supabase SQL editor. Settings need{" "}
                <code>profiles</code>, <code>user_notification_preferences</code>, and <code>task_reminders</code> to
                be available before reminders can be managed here.
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
          eyebrow="Settings load failed"
          title="DayStack reached Supabase, but reminder settings could not be loaded."
          description="Check the terminal for the server-side error details, then retry the page."
        />
      </main>
    );
  }
}
