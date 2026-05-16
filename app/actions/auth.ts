"use server";

import { createClient } from "@/lib/supabase/server";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function safeRedirectPath(path: string, fallback: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}

export async function signIn(
  _prevState: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "").trim();
  const fallback = String(formData.get("localeFallback") ?? "/en");
  const afterLogin = safeRedirectPath(redirectTo, safeRedirectPath(fallback, "/en"));

  if (!email || !password) {
    return { error: "Email and password required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(afterLogin);
}

export async function signUp(
  _prevState: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Email and password required." };
  }
  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${siteUrl}/en`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

export async function signOutAction(formData: FormData) {
  const raw = String(formData.get("locale") ?? "en");
  const locale = isLocale(raw) ? raw : defaultLocale;
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(`/${locale}`);
}
