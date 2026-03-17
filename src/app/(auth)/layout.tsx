import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { isUserDisabled } from "@/lib/auth-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && !isUserDisabled(user)) {
      redirect("/app");
    }
  }

  return children;
}
