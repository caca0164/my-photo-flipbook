import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolve a registered member id by primary email (case-insensitive). Paginates until found. */
export async function findUserIdByEmail(
  svc: SupabaseClient,
  email: string,
  maxPages = 40,
): Promise<string | null> {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find((u) => (u.email ?? "").trim().toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 1000) break;
  }
  return null;
}

export async function getAuthUserEmailById(
  svc: SupabaseClient,
  userId: string | null | undefined,
): Promise<string | null> {
  if (!userId) return null;
  const { data, error } = await svc.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email.trim() || null;
}
