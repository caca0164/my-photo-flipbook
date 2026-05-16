import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function getSessionProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return {
    user,
    role: (profile?.role as "user" | "admin" | undefined) ?? "user",
  };
}

export async function requireAdmin(locale: string, redirectPath?: string) {
  const session = await getSessionProfile();
  const loginRedirect = redirectPath ?? `/${locale}/admin`;
  if (!session) {
    redirect(`/${locale}/login?redirect=${encodeURIComponent(loginRedirect)}`);
  }
  if (session.role !== "admin") {
    redirect(`/${locale}`);
  }
  return session;
}
