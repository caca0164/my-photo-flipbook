import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function safeNextPath(path: string | null): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) return "/en";
  return path;
}

/** Exchange Supabase PKCE code for session, then redirect to `next`. */
export async function handleAuthCallback(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/en/login?error=auth_callback`);
}
