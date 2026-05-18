"use client";

import { bookingAllSlotStartTimesHm } from "@/lib/booking-types";
import type { BookingHoursTier } from "@/lib/booking-types";
import type { BookingPostPaidMatchFields } from "@/lib/booking-intake-match";
import type { Locale } from "@/lib/i18n";
import { messages } from "@/lib/i18n";
import { useMemo } from "react";

const SHOOT = ["portrait", "boudoir", "prewedding"] as const;
const PARTY = ["single", "double", "group"] as const;
const HOURS = ["h2", "h3", "h4", "h10"] as const satisfies readonly BookingHoursTier[];
const SLOT_TIMES = bookingAllSlotStartTimesHm();
const MAKEUP = ["yes", "yes_both", "no"] as const;
const FA = ["yes", "no"] as const;
const WD = [0, 1, 2, 3, 4, 5, 6] as const;

export const allPostPaidMatchFields = (): BookingPostPaidMatchFields => ({
  match_shoot_types: [...SHOOT],
  match_party_sizes: [...PARTY],
  match_hours_tiers: [...HOURS],
  match_makeup: [...MAKEUP],
  match_female_assistants: [...FA],
  match_slot_weekdays: [...WD],
  match_slot_start_times: [...SLOT_TIMES],
});

function toggleStr(arr: string[] | null | undefined, v: string): string[] | null {
  const cur = arr ?? [];
  const has = cur.includes(v);
  const next = has ? cur.filter((x) => x !== v) : [...cur, v];
  return next.length ? next : null;
}

function toggleNum(arr: number[] | null | undefined, v: number): number[] | null {
  const cur = arr ?? [];
  const has = cur.includes(v);
  const next = has ? cur.filter((x) => x !== v) : [...cur, v];
  return next.length ? next : null;
}

export default function BookingPostPaidMatchFilters({
  locale,
  values,
  onChange,
  filtersTitle,
}: {
  locale: Locale;
  values: BookingPostPaidMatchFields;
  onChange: (patch: Partial<BookingPostPaidMatchFields>) => void;
  filtersTitle?: string;
}) {
  const t = messages[locale];

  const weekdayLabel = useMemo(() => {
    const loc = locale === "zh" ? "zh-HK" : "en-HK";
    return (d: number) => {
      const ref = new Date(Date.UTC(2024, 0, 7 + d));
      return new Intl.DateTimeFormat(loc, { weekday: "short" }).format(ref);
    };
  }, [locale]);

  function hoursTierLabel(tier: BookingHoursTier): string {
    if (tier === "h2") return t.bookingHours2;
    if (tier === "h3") return t.bookingHours3;
    if (tier === "h4") return t.bookingHours4;
    return t.bookingHoursFullDay;
  }

  return (
    <>
      <p className="mt-5 text-sm font-medium text-zinc-400">{filtersTitle ?? t.adminBookingIntakeFiltersTitle}</p>
      <p className="mt-1 text-xs text-zinc-600">{t.adminBookingIntakeFiltersHint}</p>
      <button
        type="button"
        onClick={() => onChange(allPostPaidMatchFields())}
        className="mt-2 rounded-lg border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:border-amber-500/40 hover:text-amber-100"
      >
        {t.adminBookingIntakeSelectAllFilters}
      </button>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="w-full text-xs text-zinc-500">{t.adminBookingIntakeMatchShoot}</span>
        {SHOOT.map((v) => (
          <label key={v} className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-xs">
            <input
              type="checkbox"
              checked={(values.match_shoot_types ?? []).includes(v)}
              onChange={() => onChange({ match_shoot_types: toggleStr(values.match_shoot_types, v) })}
            />
            {v}
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="w-full text-xs text-zinc-500">{t.adminBookingIntakeMatchParty}</span>
        {PARTY.map((v) => (
          <label key={v} className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-xs">
            <input
              type="checkbox"
              checked={(values.match_party_sizes ?? []).includes(v)}
              onChange={() => onChange({ match_party_sizes: toggleStr(values.match_party_sizes, v) })}
            />
            {v}
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="w-full text-xs text-zinc-500">{t.adminBookingIntakeMatchHours}</span>
        {HOURS.map((v) => (
          <label key={v} className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-xs">
            <input
              type="checkbox"
              checked={(values.match_hours_tiers ?? []).includes(v)}
              onChange={() => onChange({ match_hours_tiers: toggleStr(values.match_hours_tiers, v) })}
            />
            {hoursTierLabel(v)}
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="w-full text-xs text-zinc-500">{t.adminBookingIntakeMatchSlotTime}</span>
        {SLOT_TIMES.map((hm) => (
          <label
            key={hm}
            className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-xs font-mono"
          >
            <input
              type="checkbox"
              checked={(values.match_slot_start_times ?? []).includes(hm)}
              onChange={() => onChange({ match_slot_start_times: toggleStr(values.match_slot_start_times, hm) })}
            />
            {hm}
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="w-full text-xs text-zinc-500">{t.adminBookingIntakeMatchMakeup}</span>
        {MAKEUP.map((v) => (
          <label key={v} className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-xs">
            <input
              type="checkbox"
              checked={(values.match_makeup ?? []).includes(v)}
              onChange={() => onChange({ match_makeup: toggleStr(values.match_makeup, v) })}
            />
            {v === "yes"
              ? t.bookingMakeupYes
              : v === "yes_both"
                ? t.bookingMakeupYesBoth
                : t.bookingMakeupNo}
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="w-full text-xs text-zinc-500">{t.adminBookingIntakeMatchFa}</span>
        {FA.map((v) => (
          <label key={v} className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-xs">
            <input
              type="checkbox"
              checked={(values.match_female_assistants ?? []).includes(v)}
              onChange={() =>
                onChange({ match_female_assistants: toggleStr(values.match_female_assistants, v) })
              }
            />
            {v}
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <span className="w-full text-xs text-zinc-500">{t.adminBookingIntakeMatchWeekday}</span>
        {WD.map((v) => (
          <label key={v} className="flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-xs">
            <input
              type="checkbox"
              checked={(values.match_slot_weekdays ?? []).includes(v)}
              onChange={() => onChange({ match_slot_weekdays: toggleNum(values.match_slot_weekdays, v) })}
            />
            {v}:{weekdayLabel(v)}
          </label>
        ))}
      </div>
    </>
  );
}
