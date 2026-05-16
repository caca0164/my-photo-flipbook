import { google } from "googleapis";
import { tryParseServiceAccountFromDbOrEnv } from "@/lib/google-service-account-json";

export type BusyInterval = { start: string; end: string };

/**
 * Normalize a pasted Calendar ID: trim, strip quotes, decode embed/ical links to `src` / owner id.
 * FreeBusy `items[].id` must be the calendar identifier (e.g. `you@gmail.com` or `xxx@group.calendar.google.com`).
 */
export function normalizeGoogleCalendarId(raw: string): string {
  let s = raw.trim().replace(/^["']|["']$/g, "").trim();
  if (!s) return s;

  const icalMatch = s.match(/calendar\.google\.com\/calendar\/ical\/([^/]+)\//i);
  if (icalMatch) {
    try {
      s = decodeURIComponent(icalMatch[1]);
    } catch {
      s = icalMatch[1];
    }
    return s.trim();
  }

  try {
    if (s.includes("://")) {
      const u = new URL(s);
      const src = u.searchParams.get("src");
      if (src) {
        s = decodeURIComponent(src);
      }
    }
  } catch {
    /* keep s */
  }
  return s.trim();
}

/**
 * Returns busy intervals from Google Calendar FreeBusy (UTC ISO strings).
 * `serviceAccountJson` is DB-stored key; `envServiceAccountJson` is `GOOGLE_SERVICE_ACCOUNT_JSON`.
 * If DB value does not parse, a valid env key is used (see `tryParseServiceAccountFromDbOrEnv`).
 */
export async function fetchGoogleCalendarBusy(params: {
  calendarId: string;
  serviceAccountJson: string | null | undefined;
  envServiceAccountJson: string | undefined;
  timeMin: Date;
  timeMax: Date;
}): Promise<BusyInterval[] | { error: string }> {
  const calId = normalizeGoogleCalendarId(params.calendarId);
  if (!calId) {
    return [];
  }
  const parsed = tryParseServiceAccountFromDbOrEnv(
    params.serviceAccountJson,
    params.envServiceAccountJson,
  );
  if (!parsed.ok) {
    return { error: parsed.error };
  }
  const creds = parsed.creds;
  const saEmail = typeof creds.client_email === "string" ? creds.client_email : "the service account client_email";
  const shareHint = `Share calendar "${calId}" with ${saEmail} (permission: see all event details or at least free/busy).`;

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
    });
    const calendar = google.calendar({ version: "v3", auth });
    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin: params.timeMin.toISOString(),
        timeMax: params.timeMax.toISOString(),
        items: [{ id: calId }],
      },
    });
    const calendars = res.data.calendars ?? {};
    type CalEntry = {
      busy?: { start?: string | null; end?: string | null }[];
      errors?: { domain?: string; reason?: string; message?: string }[];
    };
    const calMap = calendars as Record<string, CalEntry | undefined>;

    if (Object.keys(calMap).length === 0) {
      return {
        error: `Google returned no FreeBusy data for "${calId}". Enable the Google Calendar API on the same Cloud project as this service account key. ${shareHint}`,
      };
    }

    function resolveCalendarEntry(requested: string): CalEntry | undefined {
      const trimmed = requested.trim();
      if (calMap[trimmed]) return calMap[trimmed];
      const tl = trimmed.toLowerCase();
      for (const key of Object.keys(calMap)) {
        if (key.toLowerCase() === tl) return calMap[key];
      }
      const keys = Object.keys(calMap);
      if (keys.length === 1) return calMap[keys[0]];
      return undefined;
    }

    const entry = resolveCalendarEntry(calId);

    /** If the API key does not match (encoding / casing), merge busy from every calendar entry without errors. */
    if (!entry) {
      const merged: { start?: string | null; end?: string | null }[] = [];
      let firstError: CalEntry["errors"] | undefined;
      for (const key of Object.keys(calMap)) {
        const e = calMap[key];
        if (!e) continue;
        if (e.errors?.length) {
          firstError = firstError ?? e.errors;
          continue;
        }
        merged.push(...(e.busy ?? []));
      }
      if (firstError?.length && merged.length === 0) {
        const e0 = firstError[0] as { domain?: string; reason?: string; message?: string };
        const detail = [e0.reason, e0.message].filter(Boolean).join(": ");
        return {
          error:
            (detail ? `${detail}. ` : "") +
            shareHint +
            " Use your Google account email as Calendar ID when sharing a personal calendar.",
        };
      }
      return merged.map((b) => ({ start: b.start ?? "", end: b.end ?? "" })).filter((b) => b.start && b.end);
    }

    const apiErrors = entry.errors;
    if (apiErrors?.length) {
      const e0 = apiErrors[0] as { domain?: string; reason?: string; message?: string };
      const detail = [e0.reason, e0.message].filter(Boolean).join(": ");
      return {
        error:
          (detail ? `${detail}. ` : "") +
          shareHint +
          " For a personal Gmail calendar, set Calendar ID to that Gmail address (not `primary`).",
      };
    }
    const busy = entry.busy ?? [];
    return busy.map((b) => ({ start: b.start ?? "", end: b.end ?? "" })).filter((b) => b.start && b.end);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Calendar API error";
    return { error: `${msg} ${shareHint}` };
  }
}
