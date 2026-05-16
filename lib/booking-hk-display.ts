import type { Locale } from "@/lib/i18n";

/** Format stored UTC instants as Hong Kong local range for UI / email. */
export function formatBookingSlotHk(isoStart: string, isoEnd: string, locale: Locale): string {
  const opt: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  const s = new Date(isoStart);
  const e = new Date(isoEnd);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) {
    return `${isoStart} → ${isoEnd}`;
  }
  const loc = locale === "zh" ? "zh-HK" : "en-HK";
  return `${s.toLocaleString(loc, opt)} → ${e.toLocaleString(loc, opt)} (HK)`;
}
