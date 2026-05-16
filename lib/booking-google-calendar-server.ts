import { createServiceRoleClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

/** Calendar ID + optional SA JSON for FreeBusy (env SA used when JSON is null). */
export type BookingGoogleCalendarCredentials = {
  calendarId: string;
  /** DB-stored key; empty means caller should use GOOGLE_SERVICE_ACCOUNT_JSON only. */
  serviceAccountJson: string | null;
};

/**
 * Reads booking Google settings: prefers service role + booking_config; if no service role,
 * uses anon RPC snapshot for calendar id + server env for SA (same pattern as public booking prices).
 */
export async function getBookingGoogleCalendarCredentials(): Promise<BookingGoogleCalendarCredentials | null> {
  const envJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() || "";

  const svc = createServiceRoleClient();
  if (svc) {
    const { data: cfg } = await svc
      .from("booking_config")
      .select("google_calendar_id, google_sa_json")
      .eq("id", "default")
      .maybeSingle();
    const row = (cfg ?? {}) as { google_calendar_id?: string; google_sa_json?: string | null };
    const calendarId = String(row.google_calendar_id ?? "").trim();
    const saDb = String(row.google_sa_json ?? "").trim();
    if (!calendarId || (!saDb && !envJson)) return null;
    return { calendarId, serviceAccountJson: saDb || null };
  }

  const supabase = await createClient();
  const { data: rpcData, error } = await supabase.rpc("booking_wizard_public_snapshot");
  if (error || rpcData == null || typeof rpcData !== "object" || Array.isArray(rpcData)) return null;
  const row = rpcData as Record<string, unknown>;
  const calendarId = String(row.google_calendar_id ?? "").trim();
  if (!calendarId || !envJson) return null;
  return { calendarId, serviceAccountJson: null };
}

/**
 * When {@link getBookingGoogleCalendarCredentials} returns null, explains why (no secrets in response).
 * Typical fix: add `SUPABASE_SERVICE_ROLE_KEY` on the server so DB-stored Admin JSON can be read for Google + `booking_orders`.
 */
export async function getBookingCalendarCredentialHint(): Promise<{ en: string; zh: string } | null> {
  if ((await getBookingGoogleCalendarCredentials()) != null) return null;

  const envJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim() || "";
  const svc = createServiceRoleClient();

  if (svc) {
    const { data: cfg } = await svc
      .from("booking_config")
      .select("google_calendar_id, google_sa_json")
      .eq("id", "default")
      .maybeSingle();
    const row = (cfg ?? {}) as { google_calendar_id?: string; google_sa_json?: string | null };
    const calendarId = String(row.google_calendar_id ?? "").trim();
    const saDb = String(row.google_sa_json ?? "").trim();
    if (!calendarId) {
      return {
        en: "Set Google Calendar ID in Admin → Booking.",
        zh: "請在後台「預約設定」填寫 Google 日曆 ID（例如你的 Gmail）。",
      };
    }
    if (!saDb && !envJson) {
      return {
        en: "Add the service account JSON in Admin (stored in DB) or set GOOGLE_SERVICE_ACCOUNT_JSON in server env.",
        zh: "請在後台貼上服務帳戶 JSON，或在伺服器環境變數設定 GOOGLE_SERVICE_ACCOUNT_JSON。",
      };
    }
    return null;
  }

  const supabase = await createClient();
  const { data: rpcData, error } = await supabase.rpc("booking_wizard_public_snapshot");
  if (error || rpcData == null || typeof rpcData !== "object" || Array.isArray(rpcData)) {
    return {
      en: `Could not load booking settings (RPC): ${error?.message ?? "unknown error"}.`,
      zh: `無法載入預約設定（RPC）：${error?.message ?? "未知錯誤"}。`,
    };
  }
  const row = rpcData as Record<string, unknown>;
  const calendarId = String(row.google_calendar_id ?? "").trim();
  const secretInDb = row._calendar_secret_in_db === true;

  if (!calendarId) {
    return {
      en: "Set Google Calendar ID in Admin → Booking.",
      zh: "請在後台「預約設定」填寫 Google 日曆 ID。",
    };
  }

  if (secretInDb && !envJson) {
    return {
      en: "A service account JSON is saved in Admin, but this deployment has no SUPABASE_SERVICE_ROLE_KEY, so the server cannot read google_sa_json from the database (and cannot read booking_orders for busy slots). Add SUPABASE_SERVICE_ROLE_KEY to server env (Supabase → Settings → API → service_role), or paste the same JSON into GOOGLE_SERVICE_ACCOUNT_JSON.",
      zh: "後台已儲存服務帳戶 JSON，但此部署沒有 SUPABASE_SERVICE_ROLE_KEY，伺服器無法從資料庫讀取 google_sa_json（也無法讀取 booking_orders 以顯示本站預約忙碌）。請在伺服器環境變數加入 service_role key（Supabase → Settings → API），或將同一把 JSON 放到 GOOGLE_SERVICE_ACCOUNT_JSON。",
    };
  }

  if (!secretInDb && !envJson) {
    return {
      en: "No service account JSON: add it in Admin (stored in DB) or set GOOGLE_SERVICE_ACCOUNT_JSON. Without SUPABASE_SERVICE_ROLE_KEY, only env JSON can be used for Google; DB-stored keys are not readable.",
      zh: "尚未設定服務帳戶 JSON：請在後台貼上並儲存，或設定 GOOGLE_SERVICE_ACCOUNT_JSON。若沒有 SUPABASE_SERVICE_ROLE_KEY，伺服器無法從資料庫讀取後台儲存的 JSON，只能使用環境變數內的 JSON。",
    };
  }

  return null;
}
