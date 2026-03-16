import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { NotificationBridge } from "@/components/app/notification-bridge";
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

    userId = user.id;
  }

  return (
    <>
      {userId ? <NotificationBridge userId={userId} /> : null}
      {children}
    </>
  );
}
