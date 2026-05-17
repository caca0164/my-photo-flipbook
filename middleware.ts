import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { defaultLocale, isLocale } from "./lib/i18n";
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const sessionResponse = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/auth/") ||
    /\.[a-zA-Z0-9]+$/.test(pathname)
  ) {
    return sessionResponse;
  }

  const segments = pathname.split("/").filter(Boolean);
  const first = segments[0];

  // Fix accidental double locale prefix (/en/en/about → /en/about).
  if (
    segments.length >= 2 &&
    first &&
    isLocale(first) &&
    segments[1] === first
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/${segments.slice(1).join("/")}`;
    const redirectResponse = NextResponse.redirect(url);
    sessionResponse.cookies.getAll().forEach((c) => {
      redirectResponse.cookies.set(c.name, c.value);
    });
    return redirectResponse;
  }

  if (!first || !isLocale(first)) {
    const url = request.nextUrl.clone();
    url.pathname =
      pathname === "/"
        ? `/${defaultLocale}`
        : `/${defaultLocale}${pathname}`;
    const redirectResponse = NextResponse.redirect(url);
    sessionResponse.cookies.getAll().forEach((c) => {
      redirectResponse.cookies.set(c.name, c.value);
    });
    return redirectResponse;
  }

  return sessionResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
