import { createServiceRoleClient } from "@/lib/supabase/service";
import { getBookingCalendarCredentialHint, getBookingGoogleCalendarCredentials } from "@/lib/booking-google-calendar-server";
import { fetchGoogleCalendarBusy } from "@/lib/google-calendar-busy";
import { hkYmdsTouchingSlot, type BusyInterval } from "@/lib/booking-slots-client";

/**
 * Confirmed / in-checkout orders block the same wall-clock slot as Google busy.
 * Uses service role (RLS denies anon reads on `booking_orders`).
 */
export async function fetchOrderBusyIntervals(
  tMin: Date,
  tMax: Date,
  options?: { excludeOrderId?: string },
): Promise<BusyInterval[]> {
  const svc = createServiceRoleClient();
  if (!svc) return [];

  let q = svc
    .from("booking_orders")
    .select("slot_start, slot_end")
    .in("status", ["paid", "pending_payment"])
    .lt("slot_start", tMax.toISOString())
    .gt("slot_end", tMin.toISOString());
  if (options?.excludeOrderId) {
    q = q.neq("id", options.excludeOrderId);
  }
  const { data, error } = await q;

  if (error || !data?.length) return [];

  return (data as { slot_start: string; slot_end: string }[])
    .map((r) => ({
      start: new Date(r.slot_start).toISOString(),
      end: new Date(r.slot_end).toISOString(),
    }))
    .filter((b) => b.start && b.end);
}

/** HK calendar days (`YYYY-MM-DD`) that have at least one **paid** site order overlapping the day (pending_payment does not mark full day). */
export async function fetchSiteOrderFullDayYmds(
  tMin: Date,
  tMax: Date,
  options?: { excludeOrderId?: string },
): Promise<string[]> {
  const svc = createServiceRoleClient();
  if (!svc) return [];

  let q = svc
    .from("booking_orders")
    .select("slot_start, slot_end")
    .eq("status", "paid")
    .lt("slot_start", tMax.toISOString())
    .gt("slot_end", tMin.toISOString());
  if (options?.excludeOrderId) {
    q = q.neq("id", options.excludeOrderId);
  }
  const { data, error } = await q;
  if (error || !data?.length) return [];

  const set = new Set<string>();
  for (const r of data as { slot_start: string; slot_end: string }[]) {
    const s = new Date(r.slot_start).toISOString();
    const e = new Date(r.slot_end).toISOString();
    for (const y of hkYmdsTouchingSlot(s, e)) set.add(y);
  }
  return [...set].sort();
}

export type MergedBookingBusyResult = {
  busy: BusyInterval[];
  /** True when Google calendar id + SA are configured (wizard “synced” hint). */
  configured: boolean;
  /** Set when Google FreeBusy failed but DB order busy may still be present. */
  googleError: string | null;
  /** Count of busy intervals returned by Google only (before merging with orders). */
  googleIntervalCount: number;
  /** Count of busy intervals from `booking_orders` only. */
  orderIntervalCount: number;
  /** When Google credentials are missing, human-readable fix (EN + ZH). */
  credentialHint: { en: string; zh: string } | null;
  /** HK `YYYY-MM-DD` where ≥1 paid site booking exists — UI treats the whole day as full (one paid booking per day). */
  siteOrderFullDayYmds: string[];
};

/**
 * Google Calendar busy + same-site `booking_orders` (paid / pending checkout).
 * @param options.excludeOrderId When set, that order's slot is omitted from DB busy (for admin reschedule checks).
 */
export async function getMergedBookingBusy(
  timeMin: Date,
  timeMax: Date,
  options?: { excludeOrderId?: string },
): Promise<MergedBookingBusyResult> {
  let siteOrderFullDayYmds: string[] = [];
  try {
    siteOrderFullDayYmds = await fetchSiteOrderFullDayYmds(timeMin, timeMax, {
      excludeOrderId: options?.excludeOrderId,
    });
  } catch {
    siteOrderFullDayYmds = [];
  }

  let orderBusy: BusyInterval[] = [];
  try {
    orderBusy = await fetchOrderBusyIntervals(timeMin, timeMax, {
      excludeOrderId: options?.excludeOrderId,
    });
  } catch {
    orderBusy = [];
  }
  const orderIntervalCount = orderBusy.length;
  const creds = await getBookingGoogleCalendarCredentials();
  const envJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!creds) {
    const credentialHint = await getBookingCalendarCredentialHint();
    return {
      busy: orderBusy,
      configured: false,
      googleError: null,
      googleIntervalCount: 0,
      orderIntervalCount,
      credentialHint,
      siteOrderFullDayYmds,
    };
  }

  const res = await fetchGoogleCalendarBusy({
    calendarId: creds.calendarId,
    serviceAccountJson: creds.serviceAccountJson,
    envServiceAccountJson: envJson,
    timeMin,
    timeMax,
  });

  if (!Array.isArray(res)) {
    return {
      busy: orderBusy,
      configured: true,
      googleError: res.error,
      googleIntervalCount: 0,
      orderIntervalCount,
      credentialHint: null,
      siteOrderFullDayYmds,
    };
  }

  return {
    busy: [...res, ...orderBusy],
    configured: true,
    googleError: null,
    googleIntervalCount: res.length,
    orderIntervalCount,
    credentialHint: null,
    siteOrderFullDayYmds,
  };
}
