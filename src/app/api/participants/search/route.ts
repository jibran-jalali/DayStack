import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { deriveDisplayName } from "@/lib/daystack";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_RESULTS = 8;
const USERS_PER_PAGE = 200;

function getUserFullName(user: User) {
  const metadata = user.user_metadata as { full_name?: string | null } | undefined;
  const fullName = metadata?.full_name?.trim();

  return fullName && fullName.length > 0 ? fullName : null;
}

function mapParticipant(user: User) {
  const fullName = getUserFullName(user);

  return {
    email: user.email ?? null,
    fullName: deriveDisplayName(fullName, user.email),
    id: user.id,
    rawFullName: fullName,
  };
}

async function listAllUsers() {
  const serviceClient = createSupabaseServiceClient();

  if (!serviceClient) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for participant search.");
  }

  const users: User[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage: USERS_PER_PAGE,
    });

    if (error) {
      throw error;
    }

    const batch = data.users ?? [];
    users.push(...batch);

    if (!data.nextPage || batch.length < USERS_PER_PAGE) {
      break;
    }

    page = data.nextPage;
  }

  return {
    serviceClient,
    users,
  };
}

export async function GET(request: Request) {
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
        message: "You must be signed in to search participants.",
      },
      { status: 401 },
    );
  }

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const limit = Math.min(Math.max(Number.parseInt(url.searchParams.get("limit") ?? "6", 10) || 6, 1), MAX_RESULTS);
    const { serviceClient, users } = await listAllUsers();

    const matches = users
      .filter((candidate) => candidate.id !== user.id)
      .map(mapParticipant)
      .filter((candidate) => {
        if (!query) {
          return true;
        }

        return (
          candidate.fullName.toLowerCase().includes(query) ||
          candidate.email?.toLowerCase().includes(query) === true
        );
      })
      .sort((left, right) => left.fullName.localeCompare(right.fullName))
      .slice(0, limit);

    if (matches.length > 0) {
      const { error: upsertError } = await serviceClient.from("profiles").upsert(
        matches.map((candidate) => ({
          full_name: candidate.rawFullName,
          id: candidate.id,
        })),
        {
          onConflict: "id",
        },
      );

      if (upsertError) {
        throw upsertError;
      }
    }

    return NextResponse.json({
      results: matches.map((candidate) => ({
        email: candidate.email,
        fullName: candidate.fullName,
        id: candidate.id,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Participant search failed.",
      },
      { status: 500 },
    );
  }
}
