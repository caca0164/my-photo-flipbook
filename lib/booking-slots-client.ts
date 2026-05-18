import {
  BOOKING_DAY_START_H,
  BOOKING_LAST_SESSION_END_H,
  BOOKING_LAST_SLOT_START_HOUR,
  BOOKING_TZ_OFFSET,
  bookingTodayYmdHk,
  type BookingHoursTier,
  type BookingMakeup,
  type BookingShootType,
  hoursTierToDurationHours,
} from "@/lib/booking-types";

export type BusyInterval = { start: string; end: string };

const HK_TZ = "Asia/Hong_Kong";

/** Busy slices within one Hong Kong calendar day, merged where overlapping. Times are HK local HH:mm. */
export function busySegmentsForDay(
  dateYmd: string,
  busy: BusyInterval[],
): { startHm: string; endHm: string; fullDay: boolean }[] {
  const day0 = new Date(`${dateYmd}T00:00:00${BOOKING_TZ_OFFSET}`).getTime();
  const day1 = day0 + 86400000;
  const raw: { s: number; e: number }[] = [];
  for (const b of busy) {
    const bs = isoMs(b.start);
    const be = isoMs(b.end);
    const s = Math.max(bs, day0);
    const e = Math.min(be, day1);
    if (e > s) raw.push({ s, e });
  }
  raw.sort((a, b) => a.s - b.s);
  const merged: { s: number; e: number }[] = [];
  for (const r of raw) {
    const last = merged[merged.length - 1];
    if (!last || r.s > last.e) merged.push({ s: r.s, e: r.e });
    else last.e = Math.max(last.e, r.e);
  }
  const fmt = (ms: number) =>
    new Intl.DateTimeFormat("en-GB", {
      timeZone: HK_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ms));
  return merged.map(({ s, e }) => {
    const startHm = fmt(s);
    const endHm = fmt(e);
    /** Clipped to [day0, day1); all-day busy formats as 00:00–00:00 — treat as full calendar day. */
    const fullDay = e - s >= 86400000 - 2000;
    return { startHm, endHm, fullDay };
  });
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/**
 * Parse Google FreeBusy / Calendar instants for slot math.
 * Date-only strings (YYYY-MM-DD) are interpreted as **start of that calendar day in Hong Kong**,
 * not UTC midnight — otherwise all-day events and some API payloads clip wrong vs `BOOKING_TZ_OFFSET`.
 */
export function busyInstantToMs(iso: string): number {
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T00:00:00${BOOKING_TZ_OFFSET}`).getTime();
  }
  return new Date(s).getTime();
}

function isoMs(iso: string): number {
  return busyInstantToMs(iso);
}

/** True if [aStart, aEnd) overlaps [bStart, bEnd) in absolute time. */
export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function slotOverlapsBusy(slotStartMs: number, slotEndMs: number, busy: BusyInterval[]): boolean {
  for (const b of busy) {
    const bs = isoMs(b.start);
    const be = isoMs(b.end);
    if (rangesOverlap(slotStartMs, slotEndMs, bs, be)) return true;
  }
  return false;
}

/** Hong Kong calendar `YYYY-MM-DD` for a UTC instant (ms). */
export function hkYmdFromUtcMs(ms: number): string {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: HK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

export function addHkCalendarDays(ymd: string, deltaDays: number): string {
  const noon = new Date(`${ymd}T12:00:00${BOOKING_TZ_OFFSET}`).getTime();
  return hkYmdFromUtcMs(noon + deltaDays * 86400000);
}

/** HK calendar days that intersect `[slotStartIso, slotEndIso)` (half-open). */
export function hkYmdsTouchingSlot(slotStartIso: string, slotEndIso: string): string[] {
  const t0 = new Date(slotStartIso).getTime();
  const t1 = new Date(slotEndIso).getTime();
  if (!(t1 > t0) || Number.isNaN(t0) || Number.isNaN(t1)) return [];
  const out = new Set<string>();
  let ymd = hkYmdFromUtcMs(t0);
  for (;;) {
    const dayStart = new Date(`${ymd}T00:00:00${BOOKING_TZ_OFFSET}`).getTime();
    const dayEnd = dayStart + 86400000;
    if (t1 > dayStart && t0 < dayEnd) out.add(ymd);
    if (t1 <= dayEnd) break;
    ymd = addHkCalendarDays(ymd, 1);
  }
  return [...out];
}

export type ListAvailableSlotStartsOptions = {
  /** HK `YYYY-MM-DD` with ≥1 paid `booking_orders` row — entire calendar day is treated as unavailable. */
  siteOrderFullDayYmds?: ReadonlySet<string> | readonly string[] | null;
};

function siteOrderFullDaySet(v: ListAvailableSlotStartsOptions["siteOrderFullDayYmds"]): Set<string> | null {
  if (v == null) return null;
  return v instanceof Set ? v : new Set(v);
}

/** Like {@link busySegmentsForDay}, but if `siteOrderFullDayYmds` contains `dateYmd`, show one full-day pill. */
export function busySegmentsForDayOrSiteFull(
  dateYmd: string,
  busy: BusyInterval[],
  siteOrderFullDayYmds: ReadonlySet<string> | readonly string[] | null | undefined,
): { startHm: string; endHm: string; fullDay: boolean }[] {
  if (siteOrderFullDaySet(siteOrderFullDayYmds)?.has(dateYmd)) {
    return [{ startHm: "00:00", endHm: "23:59", fullDay: true }];
  }
  return busySegmentsForDay(dateYmd, busy);
}

/** List "HH:mm" start times on dateYmd (YYYY-MM-DD) in BOOKING_TZ_OFFSET, step 30m, respecting day end and busy. */
export function listAvailableSlotStarts(
  dateYmd: string,
  hoursTier: BookingHoursTier,
  busy: BusyInterval[],
  opts?: ListAvailableSlotStartsOptions,
): string[] {
  if (siteOrderFullDaySet(opts?.siteOrderFullDayYmds)?.has(dateYmd)) return [];
  if (dateYmd <= bookingTodayYmdHk()) return [];
  const durH = hoursTierToDurationHours(hoursTier);
  const durMs = durH * 60 * 60 * 1000;
  const closeMs = new Date(
    `${dateYmd}T${pad2(BOOKING_LAST_SESSION_END_H)}:00:00${BOOKING_TZ_OFFSET}`,
  ).getTime();
  const out: string[] = [];
  for (let h = BOOKING_DAY_START_H; h <= BOOKING_LAST_SLOT_START_HOUR; h++) {
    for (const m of [0, 30]) {
      const hm = `${pad2(h)}:${pad2(m)}`;
      const startMs = new Date(`${dateYmd}T${hm}:00${BOOKING_TZ_OFFSET}`).getTime();
      const endMs = startMs + durMs;
      if (endMs > closeMs) continue;
      if (slotOverlapsBusy(startMs, endMs, busy)) continue;
      out.push(hm);
    }
  }
  return out;
}

/** End time label (HH:mm) same calendar day; valid for slots we emit (no wrap). */
export function slotEndHm(startHm: string, durHours: number): string {
  const [h, m] = startHm.split(":").map(Number);
  const t = h * 60 + m + durHours * 60;
  const eh = Math.floor(t / 60);
  const em = t % 60;
  return `${pad2(eh)}:${pad2(em)}`;
}

/** e.g. "10:00 – 12:00" for 2h (uses en dash). */
export function formatSlotRangeLabel(startHm: string, durHours: number): string {
  return `${startHm} – ${slotEndHm(startHm, durHours)}`;
}

/** Parse a UTC ISO instant to Hong Kong calendar `YYYY-MM-DD` and `HH:mm`. */
export function isoUtcToHkYmdHm(iso: string): { ymd: string; hm: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { ymd: "", hm: "" };
  const ymd = new Intl.DateTimeFormat("sv-SE", {
    timeZone: HK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const hm = new Intl.DateTimeFormat("en-GB", {
    timeZone: HK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return { ymd, hm: hm.replace(/\u202f/g, " ").replace(/\u00a0/g, " ") };
}

/** Hours before shoot slot start when makeup begins (pre-wedding needs longer prep). */
export function makeupLeadHoursBeforeShoot(
  shoot: BookingShootType,
  makeup?: BookingMakeup | null,
): number {
  let h = shoot === "prewedding" ? 2.5 : 1;
  if (makeup === "yes_both") h += 1;
  return h;
}

/** Makeup arrival as `YYYY-MM-DD HH:mm` in Hong Kong (UTC+8 wall clock). */
export function computeMakeupStartYmdHm(
  dateYmd: string,
  shootStartHm: string,
  shoot: BookingShootType,
  makeup: BookingMakeup,
): string {
  const leadH = makeupLeadHoursBeforeShoot(shoot, makeup);
  const [h, m] = shootStartHm.split(":").map(Number);
  const startMs = new Date(`${dateYmd}T${pad2(h)}:${pad2(m)}:00${BOOKING_TZ_OFFSET}`).getTime();
  const makeupMs = startMs - leadH * 60 * 60 * 1000;
  const d = new Date(makeupMs);
  const ymd = new Intl.DateTimeFormat("sv-SE", {
    timeZone: HK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  const hm = new Intl.DateTimeFormat("en-GB", {
    timeZone: HK_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${ymd} ${hm}`;
}
