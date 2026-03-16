import Link from "next/link";
import { AlertTriangle, DatabaseZap } from "lucide-react";

import { buttonVariants } from "@/components/shared/button";

export function SetupNotice({
  compact = false,
  showAction = true,
  eyebrow = "Supabase setup required",
  title = "Add your public Supabase credentials to unlock auth and data.",
  description = (
    <>
      Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY</code>,
      run the SQL in <code>supabase/schema.sql</code>, and the dashboard will switch from setup mode to live
      mode automatically.
    </>
  ),
}: {
  compact?: boolean;
  showAction?: boolean;
  eyebrow?: string;
  title?: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="elevated-card rounded-[28px] border border-amber-200/80 bg-gradient-to-br from-amber-50 to-white p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-amber-100 p-3 text-amber-600">
          {compact ? <AlertTriangle className="h-5 w-5" /> : <DatabaseZap className="h-5 w-5" />}
        </div>
        <div className="space-y-2">
          <p className="section-label text-amber-700/80">{eyebrow}</p>
          <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
          <div className="max-w-2xl text-sm leading-7 text-secondary-foreground">{description}</div>
          {showAction ? (
            <Link href="/signup" className={buttonVariants({ variant: "secondary", size: "sm", className: "mt-2" })}>
              Open signup page
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
