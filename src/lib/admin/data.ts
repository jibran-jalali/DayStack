import "server-only";

import type { User } from "@supabase/supabase-js";

import { isUserDisabled } from "@/lib/auth-status";
import { deriveDisplayName } from "@/lib/daystack";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import type { AdminAccount, AdminDashboardSnapshot } from "@/types/admin";
import type { Database } from "@/types/database";
import type { ProfileRecord } from "@/types/daystack";

const USERS_PER_PAGE = 200;
const DISABLE_DURATION = "876000h";

type UsageRow = Database["public"]["Functions"]["admin_account_usage_snapshot"]["Returns"][number];

function buildSnapshot(accounts: AdminAccount[]): AdminDashboardSnapshot {
  const activeAccounts = accounts.filter((account) => account.status === "active").length;
  const disabledAccounts = accounts.length - activeAccounts;

  return {
    accounts,
    activeAccounts,
    disabledAccounts,
    totalAccounts: accounts.length,
  };
}

function sortAccounts(accounts: AdminAccount[]) {
  return [...accounts].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function getRequiredServiceClient() {
  const client = createSupabaseServiceClient();

  if (!client) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for the admin dashboard.");
  }

  return client;
}

async function listAllAuthUsers() {
  const client = getRequiredServiceClient();
  const users: User[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({
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

  return users;
}

async function fetchProfilesByIds(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, Pick<ProfileRecord, "full_name" | "id">>();
  }

  const client = getRequiredServiceClient();
  const { data, error } = await client.from("profiles").select("id, full_name").in("id", userIds);

  if (error) {
    throw error;
  }

  return new Map(
    (data ?? []).map((profile) => [profile.id, profile as Pick<ProfileRecord, "full_name" | "id">]),
  );
}

async function fetchUsageByIds(userIds: string[]) {
  if (userIds.length === 0) {
    return new Map<string, number | null>();
  }

  const client = getRequiredServiceClient();
  const { data, error } = await client.rpc("admin_account_usage_snapshot", {
    p_user_ids: userIds,
  });

  if (error) {
    console.error("Admin usage snapshot failed:", error);
    return new Map<string, number | null>(userIds.map((userId) => [userId, null]));
  }

  const rows = (data ?? []) as UsageRow[];

  return new Map(
    userIds.map((userId) => {
      const usageRow = rows.find((row) => row.user_id === userId);
      const estimatedOwnedRecords =
        typeof usageRow?.estimated_owned_records === "string"
          ? Number.parseInt(usageRow.estimated_owned_records, 10)
          : usageRow?.estimated_owned_records ?? 0;

      return [userId, Number.isFinite(estimatedOwnedRecords) ? estimatedOwnedRecords : 0];
    }),
  );
}

function mapAdminAccount(
  user: User,
  profile: Pick<ProfileRecord, "full_name" | "id"> | undefined,
  usage: number | null | undefined,
): AdminAccount {
  const metadata = user.user_metadata as { full_name?: string | null } | undefined;

  return {
    createdAt: user.created_at,
    email: user.email ?? "Not available",
    estimatedOwnedRecords: typeof usage === "number" ? usage : null,
    id: user.id,
    lastSignInAt: user.last_sign_in_at ?? null,
    name: deriveDisplayName(profile?.full_name ?? metadata?.full_name, user.email),
    status: isUserDisabled(user) ? "disabled" : "active",
  };
}

async function mapUsersToAdminAccounts(users: User[]) {
  const userIds = users.map((user) => user.id);
  const [profilesById, usageById] = await Promise.all([fetchProfilesByIds(userIds), fetchUsageByIds(userIds)]);

  return sortAccounts(
    users.map((user) => mapAdminAccount(user, profilesById.get(user.id), usageById.get(user.id))),
  );
}

async function fetchAuthUserById(accountId: string) {
  const client = getRequiredServiceClient();
  const { data, error } = await client.auth.admin.getUserById(accountId);

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Account not found.");
  }

  return data.user;
}

async function mapSingleAccount(user: User) {
  const [profilesById, usageById] = await Promise.all([fetchProfilesByIds([user.id]), fetchUsageByIds([user.id])]);
  return mapAdminAccount(user, profilesById.get(user.id), usageById.get(user.id));
}

export async function fetchAdminDashboardSnapshot() {
  const users = await listAllAuthUsers();
  const accounts = await mapUsersToAdminAccounts(users);

  return buildSnapshot(accounts);
}

export async function disableAdminAccount(accountId: string) {
  const client = getRequiredServiceClient();
  const { data, error } = await client.auth.admin.updateUserById(accountId, {
    ban_duration: DISABLE_DURATION,
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    return mapSingleAccount(await fetchAuthUserById(accountId));
  }

  return mapSingleAccount(data.user);
}

export async function activateAdminAccount(accountId: string) {
  const client = getRequiredServiceClient();
  const { data, error } = await client.auth.admin.updateUserById(accountId, {
    ban_duration: "none",
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    return mapSingleAccount(await fetchAuthUserById(accountId));
  }

  return mapSingleAccount(data.user);
}

export async function deleteAdminAccount(accountId: string) {
  const client = getRequiredServiceClient();
  const { error } = await client.auth.admin.deleteUser(accountId, false);

  if (error) {
    throw error;
  }
}
