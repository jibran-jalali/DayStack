import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy";

function redirectWithCookies(pathname: string, request: NextRequest, response: NextResponse) {
  const redirectResponse = NextResponse.redirect(new URL(pathname, request.url));

  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
  });

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  if (!isSupabaseConfigured()) {
    return response;
  }

  if (pathname.startsWith("/app") && !user) {
    return redirectWithCookies("/login", request, response);
  }

  if ((pathname === "/login" || pathname === "/signup") && user) {
    return redirectWithCookies("/app", request, response);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
