export interface SupabaseEnv {
  url: string;
  publishableKey: string;
}

export interface OneSignalEnv {
  appId: string;
}

export function getSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !publishableKey) {
    return null;
  }

  return {
    url,
    publishableKey,
  };
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseEnv());
}

export function getOneSignalEnv(): OneSignalEnv | null {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID?.trim();

  if (!appId) {
    return null;
  }

  return {
    appId,
  };
}

export function isOneSignalConfigured() {
  return Boolean(getOneSignalEnv());
}
