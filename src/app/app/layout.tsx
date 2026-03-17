import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { NotificationBridge } from "@/components/app/notification-bridge";
import { isUserDisabled } from "@/lib/auth-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseServerClient();
  let userId: string | null = null;

  if (supabase) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login");
    }

    if (isUserDisabled(user)) {
      redirect("/login?disabled=1");
    }

    userId = user.id;
  }

  return (
    <>
      {userId ? <NotificationBridge userId={userId} /> : null}
      {children}
    </>
  );
}
