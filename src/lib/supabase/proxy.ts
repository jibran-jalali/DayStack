import { type NextRequest } from "next/server";

import { createClient } from "@/utils/supabase/middleware";

export async function updateSession(request: NextRequest) {
  const { response, supabase } = createClient(request);

  if (!supabase) {
    return {
      response,
      user: null,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    response,
    user,
  };
}
