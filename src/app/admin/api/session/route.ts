import { NextResponse } from "next/server";

import {
  clearAdminSessionCookie,
  isAdminConfigured,
  setAdminSessionCookie,
  validateAdminCredentials,
} from "@/lib/admin/auth";

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      {
        message: "Admin credentials are not configured on the server.",
      },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as
    | {
        password?: string;
        username?: string;
      }
    | null;

  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!validateAdminCredentials(username, password)) {
    return NextResponse.json(
      {
        message: "Invalid admin credentials.",
      },
      { status: 401 },
    );
  }

  const response = NextResponse.json({
    ok: true,
  });

  setAdminSessionCookie(response);

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({
    ok: true,
    redirectTo: "/admin/login",
  });

  clearAdminSessionCookie(response);

  return response;
}
