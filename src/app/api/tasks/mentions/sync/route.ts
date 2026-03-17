import { NextResponse } from "next/server";

import { syncTaskMentionNotificationsForTask } from "@/lib/data/notifications";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.json(
      {
        message: "Supabase is not configured.",
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
        message: "You must be signed in to sync mentions.",
      },
      { status: 401 },
    );
  }

  const serviceClient = createSupabaseServiceClient();

  if (!serviceClient) {
    return NextResponse.json(
      {
        message: "SUPABASE_SERVICE_ROLE_KEY is required to sync mentions.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        taskId?: string;
      }
    | null;
  const taskId = typeof body?.taskId === "string" ? body.taskId.trim() : "";

  if (!taskId) {
    return NextResponse.json(
      {
        message: "Task id is required.",
      },
      { status: 400 },
    );
  }

  try {
    await syncTaskMentionNotificationsForTask(serviceClient, user.id, taskId);

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Mention synchronization failed.",
      },
      { status: 500 },
    );
  }
}
