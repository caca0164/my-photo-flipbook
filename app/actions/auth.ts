"use server";

import { findUserIdByEmail } from "@/lib/supabase/admin-auth-users";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { defaultLocale, isLocale } from "@/lib/i18n";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type AuthActionState = {
  error?: string;
  success?: string;
} | null;

function safeRedirectPath(path: string, fallback: string) {
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}

async function getSiteOrigin(): Promise<string> {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

/** Sign in; if email is not registered, create an account with the same password. */
export async function signInOrSignUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "").trim();
  const fallback = String(formData.get("localeFallback") ?? "/en");
  const afterLogin = safeRedirectPath(redirectTo, safeRedirectPath(fallback, "/en"));

  if (!email || !password) {
    return { error: "email_password_required" };
  }
  if (password.length < 6) {
    return { error: "password_too_short" };
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  if (!signInError) {
    revalidatePath("/", "layout");
    redirect(afterLogin);
  }

  const svc = createServiceRoleClient();
  if (!svc) {
    return { error: "invalid_credentials" };
  }

  const existingUserId = await findUserIdByEmail(svc, email);
  if (existingUserId) {
    return { error: "invalid_credentials" };
  }

  const origin = await getSiteOrigin();
  const locale = fallback.split("/").filter(Boolean)[0];
  const localePath = isLocale(locale) ? locale : defaultLocale;

  const { data, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(`/${localePath}`)}`,
    },
  });

  if (signUpError) {
    return { error: signUpError.message };
  }

  revalidatePath("/", "layout");

  if (data.session) {
    redirect(afterLogin);
  }

  return { success: "account_created_confirm_email" };
}

/** Send password reset email only when the address is already registered. */
export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const rawLocale = String(formData.get("locale") ?? defaultLocale);
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  if (!email) {
    return { error: "email_password_required" };
  }

  const svc = createServiceRoleClient();
  if (!svc) {
    return { error: "service_unavailable" };
  }

  const userId = await findUserIdByEmail(svc, email);
  if (!userId) {
    return { error: "email_not_registered" };
  }

  const origin = await getSiteOrigin();
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(`/${locale}/login/reset-password`)}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    return { error: error.message };
  }

  return { success: "reset_email_sent" };
}

export async function updatePassword(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const rawLocale = String(formData.get("locale") ?? defaultLocale);
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  if (!password) {
    return { error: "email_password_required" };
  }
  if (password.length < 6) {
    return { error: "password_too_short" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "reset_session_expired" };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(`/${locale}`);
}

export async function signOutAction(formData: FormData) {
  const raw = String(formData.get("locale") ?? "en");
  const locale = isLocale(raw) ? raw : defaultLocale;
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect(`/${locale}`);
}
