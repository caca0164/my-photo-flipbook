import { defaultLocale, isLocale } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function safeNextPath(path: string | null): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/en";
  return path;
}

function loginPathForNext(next: string): string {
  const first = next.split("/").filter(Boolean)[0];
  const locale = first && isLocale(first) ? first : defaultLocale;
  return `/${locale}/login`;
}

/** Exchange Supabase PKCE code for session, then redirect to `next`. */
export async function handleAuthCallback(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const loginBase = loginPathForNext(next);

  const oauthError = searchParams.get("error");
  if (oauthError) {
    const q = new URLSearchParams({ error: "auth_callback" });
    const desc = searchParams.get("error_description");
    if (desc) q.set("error_description", desc);
    return NextResponse.redirect(`${origin}${loginBase}?${q.toString()}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}${loginBase}?error=auth_callback`);
}
