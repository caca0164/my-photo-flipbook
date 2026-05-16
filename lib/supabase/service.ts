import { createClient } from "@supabase/supabase-js";

/** Avoid Next.js Data Cache / intermediary caching on service-role PostgREST calls. */
function serviceFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, cache: "no-store" });
}

/** Server-only: bypasses RLS. Required for store checkout + Stripe webhook order updates. */
export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: serviceFetch },
  });
}
